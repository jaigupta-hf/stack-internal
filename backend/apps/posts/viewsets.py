from django.db import transaction
from django.db.models import F, Max, Prefetch, Q
from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.pagination import parse_pagination_params, paginate_queryset
from comments.models import Comment
from notifications.api import create_notification
from notifications.constants import (
    NOTIFICATION_REASON_MENTIONED_IN_QUESTION,
    NOTIFICATION_REASON_QUESTION_EDITED,
)
from notifications.models import Notification
from reputation.models import Bounty

from teams.models import TeamUser

from teams.permissions import IsTeamMember
from votes.models import Vote

from tags.api import serialize_post_tags, sync_post_tags, sync_user_tags_for_post, tag_prefetch

from .constants import (
    ARTICLE_TYPE_TO_LABEL,
    ARTICLE_TYPE_VALUES,
    DEFAULT_ARTICLE_LIST_PAGE_SIZE,
    MAX_ARTICLE_LIST_PAGE_SIZE,
)
from .models import Bookmark, Post
from .models import PostFollow
from .serializers import (
    ArticleCommentOutputSerializer,
    ArticleCreateOutputModelSerializer,
    ArticleDetailOutputSerializer,
    ArticleListItemOutputSerializer,
    ArticleUpdateOutputSerializer,
    ArticleUpdateSerializer,
    CreateArticleSerializer,
    CreateQuestionOutputSerializer,
    CreateQuestionSerializer,
    QuestionDetailOutputSerializer,
    QuestionUpdateSerializer,
    QuestionListOutputSerializer,
)
from .views_common import (
    _display_name,
    _first_serializer_error,
    _serialize_bounty,
    _serialize_post_mentions,
)


class TeamScopedCrudViewSet(viewsets.ModelViewSet):
    """Base ModelViewSet that resolves team id by action for IsTeamMember checks."""

    permission_classes = [IsAuthenticated, IsTeamMember]
    http_method_names = ['get', 'post', 'patch', 'head', 'options']

    def _get_required_team_id(self, request):
        team_id = request.query_params.get('team_id')
        if team_id in (None, ''):
            return None, Response({'error': 'team_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            return int(team_id), None
        except (TypeError, ValueError):
            return None, Response({'error': 'team_id must be an integer'}, status=status.HTTP_400_BAD_REQUEST)

    def get_team_id_for_permission(self, request):
        if self.action == 'list':
            return request.query_params.get('team_id')

        if self.action == 'create':
            return request.data.get('team_id')

        lookup_pk = self.kwargs.get(self.lookup_field or 'pk')
        if lookup_pk in (None, ''):
            return None

        return self.get_queryset().filter(id=lookup_pk).values_list('team_id', flat=True).first()


class ArticleViewSet(TeamScopedCrudViewSet):
    """Router-backed CRUD endpoints for articles."""

    queryset = Post.objects.filter(type__in=ARTICLE_TYPE_VALUES)
    serializer_class = CreateArticleSerializer

    def list(self, request, *args, **kwargs):
        team_id, team_error = self._get_required_team_id(request)
        if team_error:
            return team_error

        page, page_size = parse_pagination_params(
            request,
            default_page_size=DEFAULT_ARTICLE_LIST_PAGE_SIZE,
            max_page_size=MAX_ARTICLE_LIST_PAGE_SIZE,
        )

        articles = (
            Post.objects.filter(team_id=team_id, type__in=ARTICLE_TYPE_VALUES, delete_flag=False)
            .select_related('user')
            .prefetch_related(tag_prefetch('article_tag_posts'))
            .order_by('-created_at')
        )
        articles, _ = paginate_queryset(articles, page=page, page_size=page_size)

        article_ids = [article.id for article in articles]
        post_vote_map = {
            item['post_id']: item['vote']
            for item in Vote.objects.filter(
                user=request.user,
                post_id__in=article_ids,
                comment__isnull=True,
            ).values('post_id', 'vote')
        }
        bookmarked_post_ids = set(
            Bookmark.objects.filter(user=request.user, post_id__in=article_ids).values_list('post_id', flat=True)
        )

        payload = [
            {
                'id': article.id,
                'type': article.type,
                'type_label': ARTICLE_TYPE_TO_LABEL.get(article.type, 'Article'),
                'title': article.title,
                'body': article.body,
                'tags': serialize_post_tags(article, 'article_tag_posts'),
                'user_name': article.user.name,
                'created_at': article.created_at,
                'views_count': article.views_count,
                'vote_count': article.vote_count,
                'bookmarks_count': article.bookmarks_count,
                'current_user_vote': post_vote_map.get(article.id, 0),
                'is_bookmarked': article.id in bookmarked_post_ids,
            }
            for article in articles
        ]

        output_serializer = ArticleListItemOutputSerializer(data=payload, many=True)
        output_serializer.is_valid(raise_exception=True)
        return Response(output_serializer.data, status=status.HTTP_200_OK)

    def perform_create(self, serializer):
        validated = serializer.validated_data
        with transaction.atomic():
            article = Post.objects.create(
                type=validated['type'],
                title=validated['title'],
                body=validated['body'],
                parent=None,
                team=validated['team'],
                user=self.request.user,
                approved_answer=None,
                answer_count=None,
            )
            sync_post_tags(article, validated['tags'])
            sync_user_tags_for_post(self.request.user, article)
        return article

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        article = self.perform_create(serializer)
        output_serializer = ArticleCreateOutputModelSerializer(article)
        return Response(output_serializer.data, status=status.HTTP_201_CREATED)

    def _get_article_for_detail_or_response(self, article_id):
        try:
            article = (
                Post.objects.select_related('user')
                .prefetch_related(tag_prefetch('article_tag_posts'))
                .get(id=article_id, type__in=ARTICLE_TYPE_VALUES, delete_flag=False)
            )
            return article, None
        except Post.DoesNotExist:
            return None, Response({'error': 'Article not found'}, status=status.HTTP_404_NOT_FOUND)

    def retrieve(self, request, pk=None, *args, **kwargs):
        article, article_error = self._get_article_for_detail_or_response(pk)
        if article_error:
            return article_error

        self.check_object_permissions(request, article)

        Post.objects.filter(id=article.id).update(views_count=F('views_count') + 1)
        article.refresh_from_db(fields=['views_count'])

        comments = (
            Comment.objects.filter(post_id=article.id)
            .select_related('user')
            .order_by('created_at')
        )

        comment_ids = [comment.id for comment in comments]
        comment_vote_map = {
            item['comment_id']: item['vote']
            for item in Vote.objects.filter(
                user=request.user,
                comment_id__in=comment_ids,
                post__isnull=True,
            ).values('comment_id', 'vote')
        }

        article_vote = (
            Vote.objects.filter(user=request.user, post_id=article.id, comment__isnull=True)
            .values_list('vote', flat=True)
            .first()
        )
        is_bookmarked = Bookmark.objects.filter(user=request.user, post_id=article.id).exists()

        comments_payload = [
            {
                'id': comment.id,
                'body': comment.body,
                'created_at': comment.created_at,
                'modified_at': comment.modified_at,
                'user': comment.user_id,
                'user_name': comment.user.name,
                'vote_count': comment.vote_count,
                'parent_comment': comment.parent_comment_id,
                'current_user_vote': comment_vote_map.get(comment.id, 0),
            }
            for comment in comments
        ]

        comment_serializer = ArticleCommentOutputSerializer(data=comments_payload, many=True)
        comment_serializer.is_valid(raise_exception=True)

        response_payload = {
            'id': article.id,
            'type': article.type,
            'type_label': ARTICLE_TYPE_TO_LABEL.get(article.type, 'Article'),
            'title': article.title,
            'body': article.body,
            'tags': serialize_post_tags(article, 'article_tag_posts'),
            'user': article.user_id,
            'user_name': article.user.name,
            'created_at': article.created_at,
            'modified_at': article.modified_at,
            'views_count': article.views_count,
            'vote_count': article.vote_count,
            'bookmarks_count': article.bookmarks_count,
            'current_user_vote': article_vote or 0,
            'is_bookmarked': is_bookmarked,
            'comments': comment_serializer.data,
        }

        detail_serializer = ArticleDetailOutputSerializer(data=response_payload)
        detail_serializer.is_valid(raise_exception=True)

        return Response(detail_serializer.data, status=status.HTTP_200_OK)

    def partial_update(self, request, pk=None, *args, **kwargs):
        article, article_error = self._get_article_for_detail_or_response(pk)
        if article_error:
            return article_error

        self.check_object_permissions(request, article)

        if article.user_id != request.user.id:
            return Response({'error': 'Only the author can edit this article'}, status=status.HTTP_403_FORBIDDEN)

        update_serializer = ArticleUpdateSerializer(data=request.data)
        if not update_serializer.is_valid():
            return Response(
                {'error': _first_serializer_error(update_serializer.errors)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        validated = update_serializer.validated_data

        with transaction.atomic():
            article.title = validated['title']
            article.body = validated['body']
            article.type = validated['type']
            article.edited_by = request.user
            article.save()
            sync_post_tags(article, validated['tags'])

        article = (
            Post.objects.select_related('user')
            .prefetch_related(tag_prefetch('article_tag_posts'))
            .get(id=pk, type__in=ARTICLE_TYPE_VALUES, delete_flag=False)
        )

        response_payload = {
            'id': article.id,
            'type': article.type,
            'type_label': ARTICLE_TYPE_TO_LABEL.get(article.type, 'Article'),
            'title': article.title,
            'body': article.body,
            'tags': serialize_post_tags(article, 'article_tag_posts'),
            'user': article.user_id,
            'user_name': article.user.name,
            'created_at': article.created_at,
            'modified_at': article.modified_at,
            'views_count': article.views_count,
        }

        response_serializer = ArticleUpdateOutputSerializer(data=response_payload)
        response_serializer.is_valid(raise_exception=True)

        return Response(response_serializer.data, status=status.HTTP_200_OK)


class QuestionViewSet(TeamScopedCrudViewSet):
    """Router-backed CRUD endpoints for questions."""

    queryset = Post.objects.filter(type=0)
    serializer_class = CreateQuestionSerializer

    def list(self, request, *args, **kwargs):
        team_id, team_error = self._get_required_team_id(request)
        if team_error:
            return team_error

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
                user=request.user,
                post_id__in=question_ids,
                comment__isnull=True,
            ).values('post_id', 'vote')
        }
        bookmarked_post_ids = set(
            Bookmark.objects.filter(user=request.user, post_id__in=question_ids).values_list('post_id', flat=True)
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

    def perform_create(self, serializer):
        validated = serializer.validated_data
        with transaction.atomic():
            question = Post.objects.create(
                type=0,
                title=validated['title'],
                body=validated['body'],
                parent=None,
                team=validated['team'],
                user=self.request.user,
                approved_answer=None,
            )
            sync_post_tags(question, validated.get('tags', []))
            sync_user_tags_for_post(self.request.user, question)
        return question

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        question = self.perform_create(serializer)

        output = CreateQuestionOutputSerializer(
            data={
                'id': question.id,
                'type': question.type,
                'title': question.title,
                'body': question.body,
                'parent': question.parent_id,
                'created_at': question.created_at,
                'modified_at': question.modified_at,
                'team': question.team_id,
                'user': question.user_id,
                'approved_answer': question.approved_answer_id,
            }
        )
        output.is_valid(raise_exception=True)
        return Response(output.data, status=status.HTTP_201_CREATED)

    def _question_detail_queryset(self, user):
        answer_queryset = (
            Post.objects.filter(type=1)
            .filter(Q(delete_flag=False) | Q(delete_flag=True, user=user))
            .select_related('user', 'edited_by')
            .order_by('created_at')
        )

        return Post.objects.select_related('user', 'edited_by', 'closed_by', 'parent').prefetch_related(
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

    def _build_question_detail_response(self, request, question):
        # Keep user display names consistent with existing team display rules.
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
        is_bookmarked = Bookmark.objects.filter(user=request.user, post_id=question.id).exists()
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
                user=request.user,
                post_id__in=post_ids,
                comment__isnull=True,
            ).values('post_id', 'vote')
        }
        comment_vote_map = {
            item['comment_id']: item['vote']
            for item in Vote.objects.filter(
                user=request.user,
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
        is_following = PostFollow.objects.filter(post=question, user=request.user).exists()
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
            'can_approve_answers': question.user_id == request.user.id and not question.delete_flag,
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
                question.user_id == request.user.id
                and not question.delete_flag
                and not bool(question.closed_reason)
                and (question.bounty_amount or 0) == 0
            ),
            'can_award_bounty': question.user_id == request.user.id and (question.bounty_amount or 0) > 0,
            'comments': comments_by_post_id.get(question.id, []),
            'answers': answers_payload,
        }

        output = QuestionDetailOutputSerializer(data=response_payload)
        output.is_valid(raise_exception=True)
        return Response(output.data, status=status.HTTP_200_OK)

    def retrieve(self, request, pk=None, *args, **kwargs):
        try:
            question = self._question_detail_queryset(request.user).get(id=pk, type=0)
        except Post.DoesNotExist:
            return Response({'error': 'Question not found'}, status=status.HTTP_404_NOT_FOUND)

        self.check_object_permissions(request, question)

        Post.objects.filter(id=question.id).update(views_count=F('views_count') + 1)
        question.refresh_from_db(fields=['views_count'])

        return self._build_question_detail_response(request, question)

    def partial_update(self, request, pk=None, *args, **kwargs):
        try:
            question = self._question_detail_queryset(request.user).get(id=pk, type=0)
        except Post.DoesNotExist:
            return Response({'error': 'Question not found'}, status=status.HTTP_404_NOT_FOUND)

        self.check_object_permissions(request, question)

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
            question.edited_by = request.user
            question.save()

            if tags is not None:
                sync_post_tags(question, tags)

        create_notification(
            post=question,
            user=question.user,
            triggered_by=request.user,
            reason=NOTIFICATION_REASON_QUESTION_EDITED,
        )

        question = self._question_detail_queryset(request.user).get(id=pk, type=0)
        self.check_object_permissions(request, question)

        return self._build_question_detail_response(request, question)
