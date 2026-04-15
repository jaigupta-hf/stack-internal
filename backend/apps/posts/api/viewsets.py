from django.db.models import Count, F, Max, Prefetch, Q
from rest_framework.decorators import action
from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.pagination import parse_pagination_params, paginate_queryset
from comments.models import Comment
from notifications.constants import (
    NOTIFICATION_REASON_MENTIONED_IN_QUESTION,
)
from notifications.models import Notification
from reputation.models import Bounty

from teams.models import TeamUser

from teams.permissions import IsTeamMember
from votes.models import Vote

from tags.api import serialize_post_tags, tag_prefetch
from .permissions import IsPostAuthor, IsPostAuthorOrTeamAdmin
from ..services import PostService

from ..constants import (
    ARTICLE_TYPE_TO_LABEL,
    ARTICLE_TYPE_VALUES,
    DEFAULT_ARTICLE_LIST_PAGE_SIZE,
    MAX_ARTICLE_LIST_PAGE_SIZE,
)
from ..models import Bookmark, Post
from ..models import PostActivity
from ..models import PostFollow
from ..models import PostVersion
from .serializers import (
    ArticleDetailModelSerializer,
    ArticleListModelSerializer,
    ArticleCreateOutputModelSerializer,
    ArticleUpdateOutputSerializer,
    ArticleUpdateSerializer,
    CreateArticleSerializer,
    AwardQuestionBountyInputSerializer,
    CreateQuestionOutputSerializer,
    CreateQuestionSerializer,
    OfferQuestionBountyInputSerializer,
    PostActivityOutputSerializer,
    PostDeleteStateOutputSerializer,
    PostVersionOutputSerializer,
    QuestionBountyStateOutputSerializer,
    QuestionAwardBountyOutputSerializer,
    QuestionCloseInputSerializer,
    QuestionCloseOutputSerializer,
    QuestionDetailModelSerializer,
    QuestionFollowStateOutputSerializer,
    QuestionListModelSerializer,
    QuestionUpdateSerializer,
    QuestionListOutputSerializer,
    QuestionMentionsCreatedOutputSerializer,
    QuestionMentionInputSerializer,
    QuestionMentionsRemovedOutputSerializer,
    RemoveQuestionMentionInputSerializer,
)
from .views_common import (
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

    def get_user_interactions_map(self, request, post_ids):
        if not post_ids:
            return {}, set()

        post_vote_map = {
            item['post_id']: item['vote']
            for item in Vote.objects.filter(
                user=request.user,
                post_id__in=post_ids,
                comment__isnull=True,
            ).values('post_id', 'vote')
        }
        bookmarked_post_ids = set(
            Bookmark.objects.filter(user=request.user, post_id__in=post_ids).values_list('post_id', flat=True)
        )

        return post_vote_map, bookmarked_post_ids

    def increment_post_views(self, post):
        Post.objects.filter(id=post.id).update(views_count=F('views_count') + 1)
        post.refresh_from_db(fields=['views_count'])


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
        post_vote_map, bookmarked_post_ids = self.get_user_interactions_map(request, article_ids)
        serializer = ArticleListModelSerializer(
            articles,
            many=True,
            context={
                'request': request,
                'post_vote_map': post_vote_map,
                'bookmarked_post_ids': bookmarked_post_ids,
            },
        )
        return Response(serializer.data, status=status.HTTP_200_OK)

    def perform_create(self, serializer):
        validated = serializer.validated_data
        article = PostService.create_article(
            user=self.request.user,
            team=validated['team'],
            post_type=validated['type'],
            title=validated['title'],
            body=validated['body'],
            tags=validated['tags'],
        )
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

        self.increment_post_views(article)

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

        post_vote_map, bookmarked_post_ids = self.get_user_interactions_map(request, [article.id])
        serializer = ArticleDetailModelSerializer(
            article,
            context={
                'request': request,
                'post_vote_map': post_vote_map,
                'bookmarked_post_ids': bookmarked_post_ids,
                'comments': comments,
                'comment_vote_map': comment_vote_map,
            },
        )

        return Response(serializer.data, status=status.HTTP_200_OK)

    def get_permissions(self):
        permission_classes = list(self.permission_classes)
        if self.action == 'partial_update':
            permission_classes.append(IsPostAuthor)
        return [permission() for permission in permission_classes]

    def partial_update(self, request, pk=None, *args, **kwargs):
        article, article_error = self._get_article_for_detail_or_response(pk)
        if article_error:
            return article_error

        self.check_object_permissions(request, article)

        update_serializer = ArticleUpdateSerializer(data=request.data)
        if not update_serializer.is_valid():
            return Response(
                {'error': _first_serializer_error(update_serializer.errors)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        validated = update_serializer.validated_data

        PostService.update_article(
            article=article,
            actor=request.user,
            post_type=validated['type'],
            title=validated['title'],
            body=validated['body'],
            tags=validated['tags'],
        )

        article = (
            Post.objects.select_related('user')
            .prefetch_related(tag_prefetch('article_tag_posts'))
            .get(id=article.id)
        )

        output = ArticleUpdateOutputSerializer(
            data={
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
        )
        output.is_valid(raise_exception=True)
        return Response(output.data, status=status.HTTP_200_OK)


class QuestionViewSet(TeamScopedCrudViewSet):
    queryset = Post.objects.filter(type=0).annotate(followers_count=Count('follows'))
    serializer_class = CreateQuestionSerializer

    def get_permissions(self):
        permission_classes = list(self.permission_classes)

        if self.action in {
            'partial_update',
            'offer_bounty',
            'award_bounty',
            'remove_mention',
            'mark_deleted',
            'undelete',
        }:
            permission_classes.append(IsPostAuthor)

        if self.action in {'close', 'reopen'}:
            permission_classes.append(IsPostAuthorOrTeamAdmin)

        return [permission() for permission in permission_classes]

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
        expired_question_ids = self._cleanup_expired_bounties(question_ids)
        if expired_question_ids:
            for question in questions:
                if question.id in expired_question_ids:
                    question.bounty_amount = 0

        question_user_ids = [question.user_id for question in questions]
        admin_user_ids = set(
            TeamUser.objects.filter(team_id=team_id, user_id__in=question_user_ids, is_admin=True).values_list('user_id', flat=True)
        )
        post_vote_map, bookmarked_post_ids = self.get_user_interactions_map(request, question_ids)

        serializer = QuestionListModelSerializer(
            questions,
            many=True,
            context={
                'request': request,
                'admin_user_ids': admin_user_ids,
                'post_vote_map': post_vote_map,
                'bookmarked_post_ids': bookmarked_post_ids,
            },
        )

        output = QuestionListOutputSerializer(data={'items': serializer.data, 'pagination': pagination})
        output.is_valid(raise_exception=True)
        return Response(output.data, status=status.HTTP_200_OK)

    def perform_create(self, serializer):
        validated = serializer.validated_data
        question = PostService.create_question(
            user=self.request.user,
            team=validated['team'],
            title=validated['title'],
            body=validated['body'],
            tags=validated.get('tags', []),
        )
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
            .select_related('user')
            .order_by('created_at')
        )

        return Post.objects.annotate(followers_count=Count('follows')).select_related('user', 'closed_by', 'parent').prefetch_related(
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

    def _question_follow_response(self, *, question, is_following):
        followers_count = (
            self.get_queryset().filter(id=question.id).values_list('followers_count', flat=True).first() or 0
        )
        output = QuestionFollowStateOutputSerializer(
            data={
                'question_id': question.id,
                'is_following': is_following,
                'followers_count': followers_count,
            }
        )
        output.is_valid(raise_exception=True)
        return Response(output.data, status=status.HTTP_200_OK)

    def _question_close_response(
        self,
        *,
        question,
        is_closed,
        closed_reason,
        closed_at,
        closed_by,
        closed_by_username,
        duplicate_post_id,
        duplicate_post_title,
    ):
        output = QuestionCloseOutputSerializer(
            data={
                'id': question.id,
                'is_closed': is_closed,
                'closed_reason': closed_reason,
                'closed_at': closed_at,
                'closed_by': closed_by,
                'closed_by_username': closed_by_username,
                'duplicate_post_id': duplicate_post_id,
                'duplicate_post_title': duplicate_post_title,
            }
        )
        output.is_valid(raise_exception=True)
        return Response(output.data, status=status.HTTP_200_OK)

    def _question_delete_state_response(self, *, question, is_deleted):
        output = PostDeleteStateOutputSerializer(
            data={
                'id': question.id,
                'delete_flag': is_deleted,
                'is_deleted': is_deleted,
            }
        )
        output.is_valid(raise_exception=True)
        return Response(output.data, status=status.HTTP_200_OK)

    def _cleanup_expired_bounties(self, question_ids):
        return PostService.cleanup_expired_bounties(question_ids)

    def _build_question_detail_response(self, request, question):
        expired_question_ids = self._cleanup_expired_bounties([question.id])
        if question.id in expired_question_ids:
            question.bounty_amount = 0

        answer_posts = getattr(question, 'answer_posts', [])
        post_ids = [question.id, *[answer.id for answer in answer_posts]]

        comments = (
            Comment.objects.filter(post_id__in=post_ids)
            .select_related('user')
            .order_by('created_at')
        )

        # Resolve all team display names with one TeamUser query to avoid per-item lookups.
        display_name_user_ids = {question.user_id}
        if question.closed_by_id:
            display_name_user_ids.add(question.closed_by_id)
        display_name_user_ids.update(answer.user_id for answer in answer_posts)
        display_name_user_ids.update(comment.user_id for comment in comments)

        display_name_by_user_id = {
            membership.user_id: membership.user.name
            for membership in TeamUser.objects.filter(
                team_id=question.team_id,
                user_id__in=display_name_user_ids,
            ).select_related('user')
        }

        def display_name_for(user_id):
            return display_name_by_user_id.get(user_id, 'deleted user')

        # Keep user display names consistent with existing team display rules.
        def serialize_comment(comment):
            return {
                'id': comment.id,
                'body': comment.body,
                'created_at': comment.created_at,
                'modified_at': comment.modified_at,
                'user': comment.user_id,
                'user_name': display_name_for(comment.user_id),
                'vote_count': comment.vote_count,
                'parent_comment': comment.parent_comment_id,
            }

        post_vote_map, bookmarked_post_ids = self.get_user_interactions_map(request, post_ids)
        is_bookmarked = question.id in bookmarked_post_ids

        comments_by_post_id = {}
        for comment in comments:
            comments_by_post_id.setdefault(comment.post_id, []).append(serialize_comment(comment))

        comment_ids = [comment.id for comment in comments]
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

        mentions_payload = _serialize_post_mentions(question)
        is_following = PostFollow.objects.filter(post=question, user=request.user).exists()
        followers_count = getattr(question, 'followers_count', 0)
        bounty = Bounty.objects.filter(post=question).order_by('-start_time').first()

        serializer = QuestionDetailModelSerializer(
            question,
            context={
                'request': request,
                'display_name_by_user_id': display_name_by_user_id,
                'post_vote_map': post_vote_map,
                'is_bookmarked': is_bookmarked,
                'is_following': is_following,
                'followers_count': followers_count,
                'mentions_payload': mentions_payload,
                'bounty_payload': _serialize_bounty(bounty),
                'comments_by_post_id': comments_by_post_id,
            },
        )
        return Response(serializer.data, status=status.HTTP_200_OK)

    def retrieve(self, request, pk=None, *args, **kwargs):
        try:
            question = self._question_detail_queryset(request.user).get(id=pk, type=0)
        except Post.DoesNotExist:
            return Response({'error': 'Question not found'}, status=status.HTTP_404_NOT_FOUND)

        self.check_object_permissions(request, question)

        self.increment_post_views(question)

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

        PostService.update_question(
            question=question,
            actor=request.user,
            title=validated['title'],
            body=validated['body'],
            tags=tags,
        )

        question = self._question_detail_queryset(request.user).get(id=pk, type=0)
        self.check_object_permissions(request, question)

        return self._build_question_detail_response(request, question)

    @action(detail=True, methods=['get'], url_path='versions')
    def versions(self, request, pk=None):
        try:
            question = self._question_detail_queryset(request.user).get(id=pk, type=0)
        except Post.DoesNotExist:
            return Response({'error': 'Question not found'}, status=status.HTTP_404_NOT_FOUND)

        self.check_object_permissions(request, question)

        versions = question.versions.order_by('version')
        serializer = PostVersionOutputSerializer(versions, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path=r'versions/(?P<version>[^/.]+)')
    def version_detail(self, request, pk=None, version=None):
        try:
            question = self._question_detail_queryset(request.user).get(id=pk, type=0)
        except Post.DoesNotExist:
            return Response({'error': 'Question not found'}, status=status.HTTP_404_NOT_FOUND)

        self.check_object_permissions(request, question)

        try:
            version_number = int(version)
        except (TypeError, ValueError):
            return Response({'error': 'version must be an integer'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            version_obj = question.versions.get(version=version_number)
        except PostVersion.DoesNotExist:
            return Response({'error': 'Version not found'}, status=status.HTTP_404_NOT_FOUND)

        serializer = PostVersionOutputSerializer(version_obj)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path='activities')
    def activities(self, request, pk=None):
        try:
            question = self._question_detail_queryset(request.user).get(id=pk, type=0)
        except Post.DoesNotExist:
            return Response({'error': 'Question not found'}, status=status.HTTP_404_NOT_FOUND)

        self.check_object_permissions(request, question)

        page, page_size = parse_pagination_params(request, default_page_size=20, max_page_size=200)
        queryset = (
            PostActivity.objects.filter(post_id=question.id)
            .select_related('actor')
            .order_by('-created_at', '-id')
        )
        activities, pagination = paginate_queryset(queryset, page=page, page_size=page_size)
        serializer = PostActivityOutputSerializer(activities, many=True)
        return Response({'items': serializer.data, 'pagination': pagination}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='follow')
    def follow(self, request, pk=None):
        question = self.get_object()
        PostFollow.objects.get_or_create(post=question, user=request.user)
        return self._question_follow_response(question=question, is_following=True)

    @action(detail=True, methods=['post'], url_path='unfollow')
    def unfollow(self, request, pk=None):
        question = self.get_object()
        PostFollow.objects.filter(post=question, user=request.user).delete()
        return self._question_follow_response(question=question, is_following=False)

    @action(detail=True, methods=['post'], url_path='mentions')
    def add_mentions(self, request, pk=None):
        question = self.get_object()

        mention_input_serializer = QuestionMentionInputSerializer(data=request.data)
        if not mention_input_serializer.is_valid():
            return Response(
                {'error': _first_serializer_error(mention_input_serializer.errors)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        parsed_user_ids = mention_input_serializer.validated_data['user_ids']

        if request.user.id in parsed_user_ids:
            return Response({'error': 'You cannot mention yourself'}, status=status.HTTP_400_BAD_REQUEST)

        member_ids = set(
            TeamUser.objects.filter(team=question.team, user_id__in=parsed_user_ids).values_list('user_id', flat=True)
        )
        missing_user_ids = sorted(set(parsed_user_ids) - member_ids)
        if missing_user_ids:
            return Response(
                {'error': 'Some users are not members of this team', 'missing_user_ids': missing_user_ids},
                status=status.HTTP_400_BAD_REQUEST,
            )

        created_count = 0
        for target_user_id in parsed_user_ids:
            mention, created = Notification.objects.get_or_create(
                post=question,
                user_id=target_user_id,
                reason=NOTIFICATION_REASON_MENTIONED_IN_QUESTION,
                defaults={'triggered_by': request.user},
            )
            if created:
                created_count += 1
            elif mention.triggered_by_id != request.user.id:
                mention.triggered_by = request.user
                mention.save(update_fields=['triggered_by'])

        output = QuestionMentionsCreatedOutputSerializer(
            data={
                'created_count': created_count,
                'mentions': _serialize_post_mentions(question),
            }
        )
        output.is_valid(raise_exception=True)
        return Response(output.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='bounty/offer')
    def offer_bounty(self, request, pk=None):
        question = self.get_object()

        expired_question_ids = self._cleanup_expired_bounties([question.id])
        if question.id in expired_question_ids:
            question.bounty_amount = 0

        bounty_input_serializer = OfferQuestionBountyInputSerializer(
            data=request.data,
            context={'request': request, 'question': question},
        )
        if not bounty_input_serializer.is_valid():
            return Response(
                {'error': _first_serializer_error(bounty_input_serializer.errors)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        reason = bounty_input_serializer.validated_data['reason']

        bounty = PostService.offer_bounty(question=question, actor=request.user, reason=reason)

        output = QuestionBountyStateOutputSerializer(
            data={
                'question_id': question.id,
                'bounty_amount': question.bounty_amount,
                'bounty': _serialize_bounty(bounty),
            }
        )
        output.is_valid(raise_exception=True)
        return Response(output.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='bounty/award')
    def award_bounty(self, request, pk=None):
        question = self.get_object()

        expired_question_ids = self._cleanup_expired_bounties([question.id])
        if question.id in expired_question_ids:
            question.bounty_amount = 0

        bounty_award_input_serializer = AwardQuestionBountyInputSerializer(
            data=request.data,
            context={'request': request, 'question': question},
        )
        if not bounty_award_input_serializer.is_valid():
            return Response(
                {'error': _first_serializer_error(bounty_award_input_serializer.errors)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        answer = bounty_award_input_serializer.validated_data['answer']

        try:
            bounty = PostService.award_bounty(question=question, actor=request.user, answer=answer)
        except ValueError as error:
            return Response({'error': str(error)}, status=status.HTTP_400_BAD_REQUEST)

        output = QuestionAwardBountyOutputSerializer(
            data={
                'question_id': question.id,
                'bounty_amount': question.bounty_amount,
                'bounty': _serialize_bounty(bounty),
                'awarded_answer_id': answer.id,
            }
        )
        output.is_valid(raise_exception=True)
        return Response(output.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='close')
    def close(self, request, pk=None):
        question = self.get_object()

        if question.delete_flag:
            return Response({'error': 'Question not found'}, status=status.HTTP_404_NOT_FOUND)

        if question.closed_reason:
            return Response({'error': 'Question is already closed.'}, status=status.HTTP_400_BAD_REQUEST)

        close_input_serializer = QuestionCloseInputSerializer(data=request.data, context={'question': question})
        if not close_input_serializer.is_valid():
            return Response(
                {'error': _first_serializer_error(close_input_serializer.errors)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        reason_value = close_input_serializer.validated_data['reason']
        duplicate_question = close_input_serializer.validated_data.get('duplicate_question')
        duplicate_post_id_value = duplicate_question.id if duplicate_question else None
        duplicate_post_title_value = duplicate_question.title if duplicate_question else None

        closed_at = PostService.close_question(
            question=question,
            actor=request.user,
            reason=reason_value,
            duplicate_question=duplicate_question,
        )

        return self._question_close_response(
            question=question,
            is_closed=True,
            closed_reason=reason_value,
            closed_at=closed_at,
            closed_by=request.user.id,
            closed_by_username=request.user.name,
            duplicate_post_id=duplicate_post_id_value,
            duplicate_post_title=duplicate_post_title_value,
        )

    @action(detail=True, methods=['post'], url_path='mentions/remove')
    def remove_mention(self, request, pk=None):
        question = self.get_object()

        remove_input_serializer = RemoveQuestionMentionInputSerializer(data=request.data)
        if not remove_input_serializer.is_valid():
            return Response(
                {'error': _first_serializer_error(remove_input_serializer.errors)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        target_user_id = remove_input_serializer.validated_data['user_id']

        removed_count, _ = Notification.objects.filter(
            post=question,
            user_id=target_user_id,
            reason=NOTIFICATION_REASON_MENTIONED_IN_QUESTION,
        ).delete()

        output = QuestionMentionsRemovedOutputSerializer(
            data={
                'removed_count': removed_count,
                'mentions': _serialize_post_mentions(question),
            }
        )
        output.is_valid(raise_exception=True)
        return Response(output.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='reopen')
    def reopen(self, request, pk=None):
        question = self.get_object()

        if question.delete_flag:
            return Response({'error': 'Question not found'}, status=status.HTTP_404_NOT_FOUND)

        if not question.closed_reason:
            return Response({'error': 'Question is not closed.'}, status=status.HTTP_400_BAD_REQUEST)

        PostService.reopen_question(question=question, actor=request.user)

        return self._question_close_response(
            question=question,
            is_closed=False,
            closed_reason='',
            closed_at=None,
            closed_by=None,
            closed_by_username=None,
            duplicate_post_id=None,
            duplicate_post_title=None,
        )

    @action(detail=True, methods=['post'], url_path='delete')
    def mark_deleted(self, request, pk=None):
        question = self.get_object()

        PostService.mark_question_deleted(question=question, actor=request.user)

        return self._question_delete_state_response(question=question, is_deleted=True)

    @action(detail=True, methods=['post'], url_path='undelete')
    def undelete(self, request, pk=None):
        question = self.get_object()

        PostService.undelete_question(question=question, actor=request.user)

        return self._question_delete_state_response(question=question, is_deleted=False)
