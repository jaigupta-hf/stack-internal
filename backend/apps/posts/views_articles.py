from django.db import transaction
from django.db.models import F
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from teams.permissions import ensure_team_membership

from comments.models import Comment
from votes.models import Vote

from .models import Bookmark, Post
from .serializers import (
    ArticleCommentOutputSerializer,
    ArticleDetailOutputSerializer,
    ArticleListItemOutputSerializer,
    ArticleUpdateOutputSerializer,
    ArticleUpdateSerializer,
    CreateArticleSerializer,
)
from tags.api import serialize_post_tags, sync_post_tags, sync_user_tags_for_post, tag_prefetch
from .views_common import ARTICLE_TYPE_TO_LABEL, _display_name, _first_serializer_error


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_article(request):
    user = request.user

    serializer = CreateArticleSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    team = serializer.validated_data['team']
    title = serializer.validated_data['title']
    body = serializer.validated_data['body']
    article_type = serializer.validated_data['type']
    tag_names = serializer.validated_data['tags']

    membership_error = ensure_team_membership(team=team, user=user)
    if membership_error:
        return membership_error

    with transaction.atomic():
        article = Post.objects.create(
            type=article_type,
            title=title,
            body=body,
            parent=None,
            team=team,
            user=user,
            approved_answer=None,
            answer_count=None,
        )

        sync_post_tags(article, tag_names)
        sync_user_tags_for_post(user, article)

    tags_payload = [{'name': tag_name} for tag_name in tag_names]

    return Response(
        {
            'id': article.id,
            'type': article.type,
            'type_label': ARTICLE_TYPE_TO_LABEL.get(article.type, 'Article'),
            'title': article.title,
            'body': article.body,
            'parent': article.parent_id,
            'approved_answer': article.approved_answer_id,
            'answer_count': article.answer_count,
            'team': article.team_id,
            'user': article.user_id,
            'user_name': user.name,
            'tags': tags_payload,
            'created_at': article.created_at,
            'modified_at': article.modified_at,
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_articles(request):
    user = request.user

    team_id = request.query_params.get('team_id')
    if not team_id:
        return Response({'error': 'team_id is required'}, status=status.HTTP_400_BAD_REQUEST)

    membership_error = ensure_team_membership(team_id=team_id, user=user)
    if membership_error:
        return membership_error

    articles = (
        Post.objects.filter(team_id=team_id, type__in=(20, 21, 22, 23), delete_flag=False)
        .select_related('user')
        .prefetch_related(tag_prefetch('article_tag_posts'))
        .order_by('-created_at')
    )

    article_ids = [article.id for article in articles]
    post_vote_map = {
        item['post_id']: item['vote']
        for item in Vote.objects.filter(
            user=user,
            post_id__in=article_ids,
            comment__isnull=True,
        ).values('post_id', 'vote')
    }
    bookmarked_post_ids = set(
        Bookmark.objects.filter(user=user, post_id__in=article_ids).values_list('post_id', flat=True)
    )

    data = [
        {
            'id': article.id,
            'type': article.type,
            'type_label': ARTICLE_TYPE_TO_LABEL.get(article.type, 'Article'),
            'title': article.title,
            'body': article.body,
            'tags': serialize_post_tags(article, 'article_tag_posts'),
            'user_name': _display_name(article.team_id, article.user_id),
            'created_at': article.created_at,
            'views_count': article.views_count,
            'vote_count': article.vote_count,
            'bookmarks_count': article.bookmarks_count,
            'current_user_vote': post_vote_map.get(article.id, 0),
            'is_bookmarked': article.id in bookmarked_post_ids,
        }
        for article in articles
    ]

    output_serializer = ArticleListItemOutputSerializer(data=data, many=True)
    output_serializer.is_valid(raise_exception=True)

    return Response(output_serializer.data, status=status.HTTP_200_OK)


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def article_detail(request, article_id):
    user = request.user

    try:
        article = (
            Post.objects.select_related('user')
            .prefetch_related(tag_prefetch('article_tag_posts'))
            .get(id=article_id, type__in=(20, 21, 22, 23), delete_flag=False)
        )
    except Post.DoesNotExist:
        return Response({'error': 'Article not found'}, status=status.HTTP_404_NOT_FOUND)

    membership_error = ensure_team_membership(team=article.team, user=user)
    if membership_error:
        return membership_error

    if request.method == 'PATCH':
        if article.user_id != user.id:
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
            article.edited_by = user
            article.save()
            sync_post_tags(article, validated['tags'])

        article = (
            Post.objects.select_related('user')
            .prefetch_related(tag_prefetch('article_tag_posts'))
            .get(id=article_id, type__in=(20, 21, 22, 23), delete_flag=False)
        )

        response_payload = {
            'id': article.id,
            'type': article.type,
            'type_label': ARTICLE_TYPE_TO_LABEL.get(article.type, 'Article'),
            'title': article.title,
            'body': article.body,
            'tags': serialize_post_tags(article, 'article_tag_posts'),
            'user': article.user_id,
            'user_name': _display_name(article.team_id, article.user_id),
            'created_at': article.created_at,
            'modified_at': article.modified_at,
            'views_count': article.views_count,
        }
        response_serializer = ArticleUpdateOutputSerializer(data=response_payload)
        response_serializer.is_valid(raise_exception=True)

        return Response(response_serializer.data, status=status.HTTP_200_OK)

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
            user=user,
            comment_id__in=comment_ids,
            post__isnull=True,
        ).values('comment_id', 'vote')
    }

    article_vote = (
        Vote.objects.filter(user=user, post_id=article.id, comment__isnull=True)
        .values_list('vote', flat=True)
        .first()
    )
    is_bookmarked = Bookmark.objects.filter(user=user, post_id=article.id).exists()

    comments_payload = [
        {
            'id': comment.id,
            'body': comment.body,
            'created_at': comment.created_at,
            'modified_at': comment.modified_at,
            'user': comment.user_id,
            'user_name': _display_name(article.team_id, comment.user_id),
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
        'user_name': _display_name(article.team_id, article.user_id),
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
