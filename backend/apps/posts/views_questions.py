from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from teams.permissions import ensure_team_membership

from notifications.api import create_notification
from notifications.constants import (
    NOTIFICATION_REASON_QUESTION_CLOSED,
    NOTIFICATION_REASON_QUESTION_DELETED,
)
from apps.collections.models import Collection

from .models import Post
from .serializers import (
    GlobalTitleSearchItemOutputSerializer,
    PostDeleteStateOutputSerializer,
    QuestionCloseOutputSerializer,
    QuestionSearchItemOutputSerializer,
)
from .constants import (
    ARTICLE_TYPE_VALUES,
    GLOBAL_SEARCH_PER_TYPE_LIMIT,
    GLOBAL_SEARCH_TOTAL_LIMIT,
    SEARCH_QUESTION_LIMIT,
)
from .views_common import (
    _display_name,
)


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
