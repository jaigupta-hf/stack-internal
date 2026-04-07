from django.db import transaction
from django.db.models import F, Max, Prefetch, Q
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from apps.pagination import parse_pagination_params, paginate_queryset

from teams.models import TeamUser
from teams.permissions import ensure_team_membership

from notifications.api import create_notification
from notifications.models import Notification
from notifications.constants import (
    NOTIFICATION_REASON_MENTIONED_IN_QUESTION,
    NOTIFICATION_REASON_QUESTION_CLOSED,
    NOTIFICATION_REASON_QUESTION_DELETED,
    NOTIFICATION_REASON_QUESTION_EDITED,
)
from comments.models import Comment
from votes.models import Vote
from reputation.models import Bounty
from apps.collections.models import Collection

from tags.api import serialize_post_tags, sync_post_tags, tag_prefetch

from .models import Bookmark, Post, PostFollow
from .serializers import (
    GlobalTitleSearchItemOutputSerializer,
    PostDeleteStateOutputSerializer,
    QuestionCloseOutputSerializer,
    QuestionDetailOutputSerializer,
    QuestionListOutputSerializer,
    QuestionSearchItemOutputSerializer,
    QuestionUpdateSerializer,
)
from .constants import (
    ARTICLE_TYPE_VALUES,
    GLOBAL_SEARCH_PER_TYPE_LIMIT,
    GLOBAL_SEARCH_TOTAL_LIMIT,
    SEARCH_QUESTION_LIMIT,
)
from .views_common import (
    _display_name,
    _first_serializer_error,
    _serialize_bounty,
    _serialize_post_mentions,
)


# Handle list questions.
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_questions(request):
    user = request.user

    team_id = request.query_params.get('team_id')
    if not team_id:
        return Response({'error': 'team_id is required'}, status=status.HTTP_400_BAD_REQUEST)

    membership_error = ensure_team_membership(team_id=team_id, user=user)
    if membership_error:
        return membership_error

    page, page_size = parse_pagination_params(request)

    questions = (
        Post.objects.filter(team_id=team_id, type=0, delete_flag=False)
        .annotate(
            latest_answer_activity_at=Max(
                'child_posts__created_at',
                filter=Q(child_posts__type=1, child_posts__delete_flag=False),
            )
        )
        .select_related('user', 'closed_by', 'parent')
        .prefetch_related(tag_prefetch('question_tag_posts'))
        .order_by('-created_at')
    )
    questions, pagination = paginate_queryset(questions, page=page, page_size=page_size)

    question_ids = [question.id for question in questions]
    question_user_ids = [question.user_id for question in questions]
    admin_user_ids = set(
        TeamUser.objects.filter(team_id=team_id, user_id__in=question_user_ids, is_admin=True).values_list('user_id', flat=True)
    )
    post_vote_map = {
        item['post_id']: item['vote']
        for item in Vote.objects.filter(
            user=user,
            post_id__in=question_ids,
            comment__isnull=True,
        ).values('post_id', 'vote')
    }
    bookmarked_post_ids = set(
        Bookmark.objects.filter(user=user, post_id__in=question_ids).values_list('post_id', flat=True)
    )

    data = [
        {
            'id': question.id,
            'title': question.title,
            'body': question.body,
            'bounty_amount': question.bounty_amount,
            'user_id': question.user_id,
            'user_is_admin': question.user_id in admin_user_ids,
            'parent': question.parent_id,
            'tags': serialize_post_tags(question, 'question_tag_posts'),
            'answer_count': question.answer_count or 0,
            'approved_answer': question.approved_answer_id,
            'views_count': question.views_count,
            'vote_count': question.vote_count,
            'bookmarks_count': question.bookmarks_count,
            'current_user_vote': post_vote_map.get(question.id, 0),
            'is_bookmarked': question.id in bookmarked_post_ids,
            'is_closed': bool(question.closed_reason),
            'closed_reason': question.closed_reason,
            'closed_at': question.closed_at,
            'closed_by': question.closed_by_id,
            'closed_by_username': question.closed_by.name if question.closed_by else None,
            'duplicate_post_id': question.parent_id if question.closed_reason == 'duplicate' else None,
            'duplicate_post_title': question.parent.title if question.closed_reason == 'duplicate' and question.parent else None,
            'user_name': question.user.name,
            'created_at': question.created_at,
            'latest_activity_at': question.latest_answer_activity_at or question.created_at,
        }
        for question in questions
    ]
    output = QuestionListOutputSerializer(data={'items': data, 'pagination': pagination})
    output.is_valid(raise_exception=True)
    return Response(output.data, status=status.HTTP_200_OK)


# Handle search questions.
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def search_questions(request):
    user = request.user

    team_id = request.query_params.get('team_id')
    if not team_id:
        return Response({'error': 'team_id is required'}, status=status.HTTP_400_BAD_REQUEST)

    membership_error = ensure_team_membership(team_id=team_id, user=user)
    if membership_error:
        return membership_error

    query = str(request.query_params.get('q', '')).strip()

    questions = Post.objects.filter(team_id=team_id, type=0).select_related('user').order_by('-created_at')
    if query:
        questions = questions.filter(title__icontains=query)

    payload = [
        {
            'id': item.id,
            'title': item.title,
            'user_name': item.user.name,
            'created_at': item.created_at,
            'delete_flag': item.delete_flag,
            'is_closed': bool(item.closed_reason),
            'closed_reason': item.closed_reason,
        }
        for item in questions[:SEARCH_QUESTION_LIMIT]
    ]

    output = QuestionSearchItemOutputSerializer(data=payload, many=True)
    output.is_valid(raise_exception=True)

    return Response(output.data, status=status.HTTP_200_OK)


# Handle search global titles.
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def search_global_titles(request):
    user = request.user

    team_id = request.query_params.get('team_id')
    if not team_id:
        return Response({'error': 'team_id is required'}, status=status.HTTP_400_BAD_REQUEST)

    membership_error = ensure_team_membership(team_id=team_id, user=user)
    if membership_error:
        return membership_error

    query = str(request.query_params.get('q', '')).strip()
    if not query:
        return Response([], status=status.HTTP_200_OK)

    question_posts = (
        Post.objects.filter(team_id=team_id, type=0, delete_flag=False, title__icontains=query)
        .select_related('user')
        .order_by('-created_at')[:GLOBAL_SEARCH_PER_TYPE_LIMIT]
    )
    article_posts = (
        Post.objects.filter(team_id=team_id, type__in=ARTICLE_TYPE_VALUES, delete_flag=False, title__icontains=query)
        .select_related('user')
        .order_by('-created_at')[:GLOBAL_SEARCH_PER_TYPE_LIMIT]
    )
    collections = (
        Collection.objects.filter(team_id=team_id, title__icontains=query)
        .select_related('user')
        .order_by('-created_at')[:GLOBAL_SEARCH_PER_TYPE_LIMIT]
    )

    results = [
        {
            'id': item.id,
            'type': 'question',
            'title': item.title,
            'user_name': item.user.name,
            'created_at': item.created_at,
            'delete_flag': item.delete_flag,
        }
        for item in question_posts
    ]
    results.extend(
        [
            {
                'id': item.id,
                'type': 'article',
                'title': item.title,
                'user_name': item.user.name,
                'created_at': item.created_at,
            }
            for item in article_posts
        ]
    )
    results.extend(
        [
            {
                'id': item.id,
                'type': 'collection',
                'title': item.title,
                'user_name': item.user.name,
                'created_at': item.created_at,
            }
            for item in collections
        ]
    )

    results.sort(key=lambda item: item.get('created_at') or timezone.now(), reverse=True)

    output = GlobalTitleSearchItemOutputSerializer(data=results[:GLOBAL_SEARCH_TOTAL_LIMIT], many=True)
    output.is_valid(raise_exception=True)

    return Response(output.data, status=status.HTTP_200_OK)


# Load a question by id and enforce team membership for the requesting user.
def _get_accessible_question_or_response(*, question_id, user, require_not_deleted=False):
    lookup = {
        'id': question_id,
        'type': 0,
    }
    if require_not_deleted:
        lookup['delete_flag'] = False

    try:
        question = Post.objects.select_related('team').get(**lookup)
    except Post.DoesNotExist:
        return None, Response({'error': 'Question not found'}, status=status.HTTP_404_NOT_FOUND)

    membership_error = ensure_team_membership(team=question.team, user=user)
    if membership_error:
        return None, membership_error

    return question, None


# Build a consistent response payload for question close/reopen state changes.
def _question_close_state_response(*, question, is_closed, closed_reason, closed_at, closed_by, duplicate_post_id, duplicate_post_title):
    output = QuestionCloseOutputSerializer(
        data={
            'id': question.id,
            'is_closed': is_closed,
            'closed_reason': closed_reason,
            'closed_at': closed_at,
            'closed_by': closed_by,
            'closed_by_username': _display_name(question.team_id, closed_by) if closed_by else None,
            'duplicate_post_id': duplicate_post_id,
            'duplicate_post_title': duplicate_post_title,
        }
    )
    output.is_valid(raise_exception=True)
    return Response(output.data, status=status.HTTP_200_OK)


# Build a consistent response payload for question delete/undelete state changes.
def _question_delete_state_response(*, question, is_deleted):
    output = PostDeleteStateOutputSerializer(
        data={
            'id': question.id,
            'delete_flag': is_deleted,
            'is_deleted': is_deleted,
        }
    )
    output.is_valid(raise_exception=True)
    return Response(output.data, status=status.HTTP_200_OK)


# Handle close question.
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def close_question(request, question_id):
    user = request.user

    question, question_error = _get_accessible_question_or_response(
        question_id=question_id,
        user=user,
        require_not_deleted=True,
    )
    if question_error:
        return question_error

    if question.closed_reason:
        return Response({'error': 'Question is already closed.'}, status=status.HTTP_400_BAD_REQUEST)

    reason_value = str(request.data.get('reason', '')).strip().lower()
    if reason_value in ('off_topic', 'offtopic'):
        reason_value = 'off-topic'

    if reason_value not in ('duplicate', 'off-topic'):
        return Response({'error': 'reason must be either duplicate or off-topic'}, status=status.HTTP_400_BAD_REQUEST)

    duplicate_question = None
    duplicate_post_id_value = None
    duplicate_post_title_value = None
    if reason_value == 'duplicate':
        duplicate_post_id = request.data.get('duplicate_post_id')
        if not duplicate_post_id:
            return Response({'error': 'duplicate_post_id is required for duplicate close reason'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            duplicate_post_id = int(duplicate_post_id)
        except (TypeError, ValueError):
            return Response({'error': 'duplicate_post_id must be an integer'}, status=status.HTTP_400_BAD_REQUEST)

        if duplicate_post_id == question.id:
            return Response({'error': 'A question cannot be duplicate of itself'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            duplicate_question = Post.objects.get(id=duplicate_post_id, team=question.team, type=0, delete_flag=False)
        except Post.DoesNotExist:
            return Response({'error': 'Duplicate reference question not found in this team'}, status=status.HTTP_404_NOT_FOUND)

        duplicate_post_id_value = duplicate_question.id
        duplicate_post_title_value = duplicate_question.title

    closed_at = timezone.now()
    Post.objects.filter(id=question.id).update(
        closed_reason=reason_value,
        closed_by=user,
        closed_at=closed_at,
        parent=duplicate_question if reason_value == 'duplicate' else None,
    )
    create_notification(
        post=question,
        user=question.user,
        triggered_by=user,
        reason=NOTIFICATION_REASON_QUESTION_CLOSED,
    )

    return _question_close_state_response(
        question=question,
        is_closed=True,
        closed_reason=reason_value,
        closed_at=closed_at,
        closed_by=user.id,
        duplicate_post_id=duplicate_post_id_value,
        duplicate_post_title=duplicate_post_title_value,
    )


# Handle reopen question.
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reopen_question(request, question_id):
    user = request.user

    question, question_error = _get_accessible_question_or_response(
        question_id=question_id,
        user=user,
        require_not_deleted=True,
    )
    if question_error:
        return question_error

    if not question.closed_reason:
        return Response({'error': 'Question is not closed.'}, status=status.HTTP_400_BAD_REQUEST)

    Post.objects.filter(id=question.id).update(
        closed_reason='',
        closed_by=None,
        closed_at=None,
        parent=None,
    )

    return _question_close_state_response(
        question=question,
        is_closed=False,
        closed_reason='',
        closed_at=None,
        closed_by=None,
        duplicate_post_id=None,
        duplicate_post_title=None,
    )


# Handle delete question.
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def delete_question(request, question_id):
    user = request.user

    question, question_error = _get_accessible_question_or_response(
        question_id=question_id,
        user=user,
    )
    if question_error:
        return question_error

    if not question.delete_flag:
        Post.objects.filter(id=question.id).update(delete_flag=True)
        create_notification(
            post=question,
            user=question.user,
            triggered_by=user,
            reason=NOTIFICATION_REASON_QUESTION_DELETED,
        )

    return _question_delete_state_response(question=question, is_deleted=True)


# Handle undelete question.
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def undelete_question(request, question_id):
    user = request.user

    question, question_error = _get_accessible_question_or_response(
        question_id=question_id,
        user=user,
    )
    if question_error:
        return question_error

    if question.delete_flag:
        Post.objects.filter(id=question.id).update(delete_flag=False)

    return _question_delete_state_response(question=question, is_deleted=False)


# Handle question detail.
@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def question_detail(request, question_id):
    user = request.user

    try:
        answer_queryset = (
            Post.objects.filter(type=1)
            .filter(Q(delete_flag=False) | Q(delete_flag=True, user=user))
            .select_related('user', 'edited_by')
            .order_by('created_at')
        )

        question = (
            Post.objects.select_related('user', 'edited_by', 'closed_by', 'parent')
            .prefetch_related(
                Prefetch(
                    'child_posts',
                    queryset=answer_queryset,
                    to_attr='answer_posts',
                ),
                Prefetch(
                    'notifications',
                    queryset=Notification.objects.filter(reason=NOTIFICATION_REASON_MENTIONED_IN_QUESTION)
                    .select_related('user', 'triggered_by')
                    .order_by('created_at'),
                    to_attr='mention_notifications',
                ),
                tag_prefetch('question_tag_posts'),
            )
            .get(id=question_id, type=0)
        )
    except Post.DoesNotExist:
        return Response({'error': 'Question not found'}, status=status.HTTP_404_NOT_FOUND)

    membership_error = ensure_team_membership(team=question.team, user=user)
    if membership_error:
        return membership_error

    if request.method == 'PATCH':
        update_serializer = QuestionUpdateSerializer(data=request.data)
        if not update_serializer.is_valid():
            return Response(
                {'error': _first_serializer_error(update_serializer.errors)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        validated = update_serializer.validated_data
        tags = validated.get('tags', None)

        with transaction.atomic():
            question.title = validated['title']
            question.body = validated['body']
            question.edited_by = user
            question.save()

            if tags is not None:
                sync_post_tags(question, tags)

        create_notification(
            post=question,
            user=question.user,
            triggered_by=user,
            reason=NOTIFICATION_REASON_QUESTION_EDITED,
        )

        question = (
            Post.objects.select_related('user', 'edited_by', 'closed_by', 'parent')
            .prefetch_related(
                Prefetch(
                    'child_posts',
                    queryset=answer_queryset,
                    to_attr='answer_posts',
                ),
                Prefetch(
                    'notifications',
                    queryset=Notification.objects.filter(reason=NOTIFICATION_REASON_MENTIONED_IN_QUESTION)
                    .select_related('user', 'triggered_by')
                    .order_by('created_at'),
                    to_attr='mention_notifications',
                ),
                tag_prefetch('question_tag_posts'),
            )
            .get(id=question_id, type=0)
        )
    else:
        Post.objects.filter(id=question.id).update(views_count=F('views_count') + 1)
        question.refresh_from_db(fields=['views_count'])

    # Handle serialize comment.
    def serialize_comment(comment):
        return {
            'id': comment.id,
            'body': comment.body,
            'created_at': comment.created_at,
            'modified_at': comment.modified_at,
            'user': comment.user_id,
            'user_name': _display_name(question.team_id, comment.user_id),
            'vote_count': comment.vote_count,
            'parent_comment': comment.parent_comment_id,
        }

    answer_posts = getattr(question, 'answer_posts', [])
    post_ids = [question.id, *[answer.id for answer in answer_posts]]
    is_bookmarked = Bookmark.objects.filter(user=user, post_id=question.id).exists()
    comments = (
        Comment.objects.filter(post_id__in=post_ids)
        .select_related('user')
        .order_by('created_at')
    )

    comments_by_post_id = {}
    for comment in comments:
        comments_by_post_id.setdefault(comment.post_id, []).append(serialize_comment(comment))

    comment_ids = [comment.id for comment in comments]
    post_vote_map = {
        item['post_id']: item['vote']
        for item in Vote.objects.filter(
            user=user,
            post_id__in=post_ids,
            comment__isnull=True,
        ).values('post_id', 'vote')
    }
    comment_vote_map = {
        item['comment_id']: item['vote']
        for item in Vote.objects.filter(
            user=user,
            comment_id__in=comment_ids,
            post__isnull=True,
        ).values('comment_id', 'vote')
    }

    for post_comments in comments_by_post_id.values():
        for comment in post_comments:
            comment['current_user_vote'] = comment_vote_map.get(comment['id'], 0)

    answers_payload = [
        {
            'id': answer.id,
            'body': answer.body,
            'delete_flag': answer.delete_flag,
            'created_at': answer.created_at,
            'modified_at': answer.modified_at,
            'user': answer.user_id,
            'user_name': _display_name(question.team_id, answer.user_id),
            'edited_by': answer.edited_by_id,
            'edited_by_username': answer.edited_by.name if answer.edited_by else None,
            'vote_count': answer.vote_count,
            'current_user_vote': post_vote_map.get(answer.id, 0),
            'comments': comments_by_post_id.get(answer.id, []),
        }
        for answer in answer_posts
    ]

    tags_payload = serialize_post_tags(question, 'question_tag_posts')
    mentions_payload = _serialize_post_mentions(question)
    is_following = PostFollow.objects.filter(post=question, user=user).exists()
    followers_count = PostFollow.objects.filter(post=question).count()
    bounty = Bounty.objects.filter(post=question).order_by('-start_time').first()

    response_payload = {
        'id': question.id,
        'title': question.title,
        'body': question.body,
        'delete_flag': question.delete_flag,
        'bounty_amount': question.bounty_amount,
        'parent': question.parent_id,
        'created_at': question.created_at,
        'modified_at': question.modified_at,
        'team': question.team_id,
        'user': question.user_id,
        'user_name': _display_name(question.team_id, question.user_id),
        'edited_by': question.edited_by_id,
        'edited_by_username': question.edited_by.name if question.edited_by else None,
        'views_count': question.views_count,
        'vote_count': question.vote_count,
        'bookmarks_count': question.bookmarks_count,
        'current_user_vote': post_vote_map.get(question.id, 0),
        'approved_answer': question.approved_answer_id,
        'can_approve_answers': question.user_id == user.id and not question.delete_flag,
        'is_following': is_following,
        'followers_count': followers_count,
        'is_bookmarked': is_bookmarked,
        'is_closed': bool(question.closed_reason),
        'closed_reason': question.closed_reason,
        'closed_at': question.closed_at,
        'closed_by': question.closed_by_id,
        'closed_by_username': _display_name(question.team_id, question.closed_by_id) if question.closed_by else None,
        'duplicate_post_id': question.parent_id if question.closed_reason == 'duplicate' else None,
        'duplicate_post_title': question.parent.title if question.closed_reason == 'duplicate' and question.parent else None,
        'tags': tags_payload,
        'mentions': mentions_payload,
        'bounty': _serialize_bounty(bounty),
        'can_offer_bounty': (
            question.user_id == user.id
            and not question.delete_flag
            and not bool(question.closed_reason)
            and (question.bounty_amount or 0) == 0
        ),
        'can_award_bounty': question.user_id == user.id and (question.bounty_amount or 0) > 0,
        'comments': comments_by_post_id.get(question.id, []),
        'answers': answers_payload,
    }

    output = QuestionDetailOutputSerializer(data=response_payload)
    output.is_valid(raise_exception=True)

    return Response(output.data, status=status.HTTP_200_OK)
