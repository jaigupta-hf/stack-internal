from django.db.models import F
from django.db.models import Q
from django.db.models.functions import Coalesce, Greatest
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from apps.pagination import parse_pagination_params, paginate_queryset

from teams.permissions import ensure_team_membership, get_team_membership
from users.models import User

from apps.collections.models import Collection

from tags.api import serialize_post_tags, tag_prefetch

from ..models import Bookmark, Post, PostFollow
from ..constants import (
    DEFAULT_BOOKMARK_LIST_PAGE_SIZE,
    DEFAULT_FOLLOWED_POSTS_PAGE_SIZE,
    MAX_BOOKMARK_LIST_PAGE_SIZE,
    MAX_FOLLOWED_POSTS_PAGE_SIZE,
    POST_TYPE_QUESTION,
    POST_TYPE_TO_LABEL,
)


# Parse and validate mutually exclusive post_id/collection_id bookmark target fields.
def _parse_bookmark_target_or_response(payload):
    post_id = payload.get('post_id')
    collection_id = payload.get('collection_id')
    if bool(post_id) == bool(collection_id):
        return None, None, Response({'error': 'Exactly one of post_id or collection_id is required'}, status=status.HTTP_400_BAD_REQUEST)
    return post_id, collection_id, None


# Resolve bookmark target for add flow and enforce team membership.
def _resolve_add_target_or_response(*, user, post_id, collection_id):
    if post_id:
        try:
            post = Post.objects.select_related('team').get(id=post_id)
        except Post.DoesNotExist:
            return None, None, Response({'error': 'Post not found'}, status=status.HTTP_404_NOT_FOUND)

        membership_error = ensure_team_membership(team=post.team, user=user)
        if membership_error:
            return None, None, membership_error

        return 'post', post, None

    try:
        collection = Collection.objects.select_related('team').get(id=collection_id)
    except Collection.DoesNotExist:
        return None, None, Response({'error': 'Collection not found'}, status=status.HTTP_404_NOT_FOUND)

    membership_error = ensure_team_membership(team=collection.team, user=user)
    if membership_error:
        return None, None, membership_error

    return 'collection', collection, None


# Create bookmark for the resolved target and update aggregate bookmark counters when newly created.
def _create_bookmark(*, user, target_type, target):
    if target_type == 'post':
        bookmark, created = Bookmark.objects.get_or_create(
            user=user,
            post=target,
            collection=None,
        )
        if created:
            Post.objects.filter(id=target.id).update(bookmarks_count=F('bookmarks_count') + 1)
        return bookmark

    bookmark, created = Bookmark.objects.get_or_create(
        user=user,
        post=None,
        collection=target,
    )
    if created:
        Collection.objects.filter(id=target.id).update(bookmarks_count=F('bookmarks_count') + 1)
    return bookmark


# Remove bookmark for the resolved target and decrement aggregate bookmark counters.
def _remove_bookmark_or_response(*, user, post_id, collection_id):
    if post_id:
        deleted_count, _ = Bookmark.objects.filter(user=user, post_id=post_id).delete()
        if deleted_count == 0:
            return None, Response({'error': 'Bookmark not found'}, status=status.HTTP_404_NOT_FOUND)

        Post.objects.filter(id=post_id).update(
            bookmarks_count=Greatest(Coalesce(F('bookmarks_count'), 0) - deleted_count, 0)
        )
        return {'post_id': int(post_id), 'collection_id': None}, None

    deleted_count, _ = Bookmark.objects.filter(user=user, collection_id=collection_id, post__isnull=True).delete()
    if deleted_count == 0:
        return None, Response({'error': 'Bookmark not found'}, status=status.HTTP_404_NOT_FOUND)

    Collection.objects.filter(id=collection_id).update(
        bookmarks_count=Greatest(Coalesce(F('bookmarks_count'), 0) - deleted_count, 0)
    )
    return {'post_id': None, 'collection_id': int(collection_id)}, None


# Serialize one bookmark row for list response as either post or collection payload.
def _serialize_bookmark_item(item, posts_by_id):
    if item.post_id:
        post = posts_by_id.get(item.post_id, item.post)
        if not post:
            return None

        return {
            'bookmark_id': item.id,
            'target_type': 'post',
            'post_id': post.id,
            'collection_id': None,
            'delete_flag': post.delete_flag,
            'post_type': post.type,
            'post_type_label': POST_TYPE_TO_LABEL.get(post.type, 'Post'),
            'title': post.title,
            'body': post.body,
            'user_name': post.user.name,
            'created_at': post.created_at,
            'views_count': post.views_count,
            'vote_count': post.vote_count,
            'bookmarks_count': post.bookmarks_count,
            'tags': serialize_post_tags(post, 'bookmark_tag_posts'),
            'is_bookmarked': True,
        }

    collection = item.collection
    if not collection:
        return None

    return {
        'bookmark_id': item.id,
        'target_type': 'collection',
        'post_id': None,
        'collection_id': collection.id,
        'post_type': None,
        'post_type_label': 'Collection',
        'title': collection.title,
        'body': collection.description,
        'user_name': collection.user.name,
        'created_at': collection.created_at,
        'views_count': collection.views_count,
        'vote_count': collection.vote_count,
        'bookmarks_count': collection.bookmarks_count,
        'tags': [],
        'is_bookmarked': True,
    }


# Handle add bookmark.
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def add_bookmark(request):
    user = request.user

    post_id, collection_id, target_error = _parse_bookmark_target_or_response(request.data)
    if target_error:
        return target_error

    target_type, target, resolve_error = _resolve_add_target_or_response(
        user=user,
        post_id=post_id,
        collection_id=collection_id,
    )
    if resolve_error:
        return resolve_error

    bookmark = _create_bookmark(user=user, target_type=target_type, target=target)

    return Response(
        {
            'id': bookmark.id,
            'post_id': bookmark.post_id,
            'collection_id': bookmark.collection_id,
            'is_bookmarked': True,
        },
        status=status.HTTP_200_OK,
    )


# Handle remove bookmark.
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def remove_bookmark(request):
    user = request.user

    post_id, collection_id, target_error = _parse_bookmark_target_or_response(request.data)
    if target_error:
        return target_error

    target_payload, remove_error = _remove_bookmark_or_response(
        user=user,
        post_id=post_id,
        collection_id=collection_id,
    )
    if remove_error:
        return remove_error

    return Response(
        {
            'post_id': target_payload['post_id'],
            'collection_id': target_payload['collection_id'],
            'is_bookmarked': False,
        },
        status=status.HTTP_200_OK,
    )


# Handle list bookmarks.
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_bookmarks(request):
    user = request.user

    team_id = request.query_params.get('team_id')
    if not team_id:
        return Response({'error': 'team_id is required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        team_id = int(team_id)
    except (TypeError, ValueError):
        return Response({'error': 'team_id must be an integer'}, status=status.HTTP_400_BAD_REQUEST)

    membership_error = ensure_team_membership(team_id=team_id, user=user)
    if membership_error:
        return membership_error

    target_user = user
    user_id = request.query_params.get('user_id')
    if user_id:
        try:
            target_user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        if get_team_membership(team_id=team_id, user=target_user) is None:
            return Response({'error': 'User is not a member of this team'}, status=status.HTTP_404_NOT_FOUND)

    page, page_size = parse_pagination_params(
        request,
        default_page_size=DEFAULT_BOOKMARK_LIST_PAGE_SIZE,
        max_page_size=MAX_BOOKMARK_LIST_PAGE_SIZE,
    )

    bookmarks = (
        Bookmark.objects.filter(user=target_user)
        .filter(Q(post__team_id=team_id) | Q(collection__team_id=team_id))
        .select_related('post__user', 'collection__user')
        .order_by('-id')
    )
    bookmarks, _ = paginate_queryset(bookmarks, page=page, page_size=page_size)

    post_ids = [item.post_id for item in bookmarks]
    posts_by_id = {
        post.id: post
        for post in Post.objects.filter(id__in=post_ids).prefetch_related(tag_prefetch('bookmark_tag_posts'))
    }

    data = []
    for item in bookmarks:
        payload = _serialize_bookmark_item(item, posts_by_id)
        if payload:
            data.append(payload)

    return Response(data, status=status.HTTP_200_OK)


# Handle list followed posts.
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_followed_posts(request):
    user = request.user

    team_id = request.query_params.get('team_id')
    if not team_id:
        return Response({'error': 'team_id is required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        team_id = int(team_id)
    except (TypeError, ValueError):
        return Response({'error': 'team_id must be an integer'}, status=status.HTTP_400_BAD_REQUEST)

    membership_error = ensure_team_membership(team_id=team_id, user=user)
    if membership_error:
        return membership_error

    target_user = user
    user_id = request.query_params.get('user_id')
    if user_id:
        try:
            target_user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        if get_team_membership(team_id=team_id, user=target_user) is None:
            return Response({'error': 'User is not a member of this team'}, status=status.HTTP_404_NOT_FOUND)

    page, page_size = parse_pagination_params(
        request,
        default_page_size=DEFAULT_FOLLOWED_POSTS_PAGE_SIZE,
        max_page_size=MAX_FOLLOWED_POSTS_PAGE_SIZE,
    )

    follows = (
        PostFollow.objects.filter(user=target_user, post__team_id=team_id, post__type=POST_TYPE_QUESTION)
        .select_related('post__user')
        .order_by('-created_at')
    )
    follows, _ = paginate_queryset(follows, page=page, page_size=page_size)

    post_ids = [item.post_id for item in follows]
    posts_by_id = {
        post.id: post
        for post in Post.objects.filter(id__in=post_ids).prefetch_related(tag_prefetch('follow_tag_posts'))
    }

    data = []
    for item in follows:
        post = posts_by_id.get(item.post_id, item.post)
        if not post:
            continue

        data.append(
            {
                'follow_id': item.id,
                'post_id': post.id,
                'title': post.title,
                'body': post.body,
                'delete_flag': post.delete_flag,
                'user_id': post.user_id,
                'user_name': post.user.name,
                'created_at': post.created_at,
                'views_count': post.views_count,
                'vote_count': post.vote_count,
                'bookmarks_count': post.bookmarks_count,
                'answer_count': post.answer_count or 0,
                'is_closed': bool(post.closed_reason),
                'tags': serialize_post_tags(post, 'follow_tag_posts'),
            }
        )

    return Response(data, status=status.HTTP_200_OK)
