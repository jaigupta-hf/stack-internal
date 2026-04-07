from django.db import IntegrityError, transaction
from django.db.models import Count, F, Max
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from apps.pagination import parse_pagination_params, paginate_queryset
from teams.permissions import ensure_team_membership, ensure_team_admin, get_team_membership
from posts.models import Post
from posts.constants import COLLECTION_ELIGIBLE_POST_TYPE_VALUES, COLLECTION_POST_SEARCH_LIMIT, POST_TYPE_TO_LABEL
from comments.models import Comment
from votes.models import Vote
from posts.models import Bookmark
from .models import Collection, PostCollection
from .serializers import (
    AddCollectionPostSerializer,
    CollectionCommentCreateSerializer,
    CollectionCommentOutputSerializer,
    CollectionDetailOutputSerializer,
    CollectionListOutputSerializer,
    CollectionPostOutputSerializer,
    CollectionSearchPostOutputSerializer,
    CollectionSummaryOutputSerializer,
    CollectionVoteOutputSerializer,
    CreateCollectionSerializer,
)


# Build shared collection summary fields used by list/create/detail responses.
def _collection_summary_payload(collection, *, post_count):
    return {
        'id': collection.id,
        'title': collection.title,
        'description': collection.description,
        'team': collection.team_id,
        'user': collection.user_id,
        'user_name': collection.user.name,
        'created_at': collection.created_at,
        'modified_at': collection.modified_at,
        'views_count': collection.views_count,
        'post_count': post_count,
        'bookmarks_count': collection.bookmarks_count,
    }


# Build payload for a post row inside collection detail/add responses.
def _collection_post_payload(post, *, sequence_number):
    return {
        'post_id': post.id,
        'type': post.type,
        'type_label': POST_TYPE_TO_LABEL.get(post.type, 'Post'),
        'title': post.title,
        'sequence_number': sequence_number,
        'user_name': post.user.name,
        'created_at': post.created_at,
    }


# Build payload for a comment row inside collection responses.
def _collection_comment_payload(comment, *, user_name, current_user_vote):
    return {
        'id': comment.id,
        'collection_id': comment.collection_id,
        'body': comment.body,
        'created_at': comment.created_at,
        'modified_at': comment.modified_at,
        'user': comment.user_id,
        'user_name': user_name,
        'vote_count': comment.vote_count,
        'parent_comment': comment.parent_comment_id,
        'current_user_vote': current_user_vote,
    }


# Build full collection detail payload by extending summary fields with user-state and child resources.
def _collection_detail_payload(collection, *, posts_payload, comments_payload, current_user_vote, is_bookmarked):
    payload = _collection_summary_payload(collection, post_count=len(posts_payload))
    payload.update(
        {
            'vote_count': collection.vote_count,
            'current_user_vote': current_user_vote,
            'is_bookmarked': is_bookmarked,
            'posts': posts_payload,
            'comments': comments_payload,
        }
    )
    return payload


# Build payload for collection post-search results.
def _collection_search_post_payload(post, *, already_added):
    return {
        'id': post.id,
        'type': post.type,
        'type_label': POST_TYPE_TO_LABEL.get(post.type, 'Post'),
        'title': post.title,
        'user_name': post.user.name,
        'created_at': post.created_at,
        'already_added': already_added,
    }


# Build vote mutation response payload for collection vote endpoints.
def _collection_vote_response(*, collection, vote):
    output = CollectionVoteOutputSerializer(
        data={
            'collection_id': collection.id,
            'vote': vote,
            'vote_count': collection.vote_count,
        }
    )
    output.is_valid(raise_exception=True)
    return Response(output.data, status=status.HTTP_200_OK)

# Create a new collection in a team (admin-only) and return summary metadata.
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_collection(request):
    user = request.user

    serializer = CreateCollectionSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    team = serializer.validated_data['team']
    title = serializer.validated_data['title'].strip()
    description = serializer.validated_data.get('description', '').strip()

    membership = get_team_membership(team=team, user=user)
    admin_error = ensure_team_admin(
        membership=membership,
        error_message='Only team admins can create collections',
    )
    if admin_error:
        return admin_error

    collection = Collection.objects.create(
        title=title,
        description=description,
        team=team,
        user=user,
    )

    payload = _collection_summary_payload(collection, post_count=0)
    output = CollectionSummaryOutputSerializer(data=payload)
    output.is_valid(raise_exception=True)
    return Response(output.data, status=status.HTTP_201_CREATED)


# List paginated collections for a team, including creator and post-count metadata.
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_collections(request):
    user = request.user

    team_id = request.query_params.get('team_id')
    if not team_id:
        return Response({'error': 'team_id is required'}, status=status.HTTP_400_BAD_REQUEST)

    membership_error = ensure_team_membership(team_id=team_id, user=user)
    if membership_error:
        return membership_error

    page, page_size = parse_pagination_params(request)

    collections = (
        Collection.objects.filter(team_id=team_id)
        .select_related('user')
        .annotate(post_count=Count('post_collections'))
        .order_by('-created_at')
    )
    collections, pagination = paginate_queryset(collections, page=page, page_size=page_size)

    data = [_collection_summary_payload(collection, post_count=collection.post_count) for collection in collections]

    output = CollectionListOutputSerializer(data={'items': data, 'pagination': pagination})
    output.is_valid(raise_exception=True)
    return Response(output.data, status=status.HTTP_200_OK)


# Return full collection details, increment views, and include posts/comments with user-specific state.
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def collection_detail(request, collection_id):
    user = request.user

    try:
        collection = Collection.objects.select_related('user', 'team').get(id=collection_id)
    except Collection.DoesNotExist:
        return Response({'error': 'Collection not found'}, status=status.HTTP_404_NOT_FOUND)

    membership_error = ensure_team_membership(team=collection.team, user=user)
    if membership_error:
        return membership_error

    Collection.objects.filter(id=collection.id).update(views_count=F('views_count') + 1)
    collection.refresh_from_db(fields=['views_count'])

    collection_posts = (
        PostCollection.objects.filter(collection=collection)
        .select_related('post', 'post__user')
        .order_by('sequence_number', 'id')
    )

    collection_comments = (
        Comment.objects.filter(collection=collection)
        .select_related('user')
        .order_by('created_at', 'id')
    )

    comment_ids = [comment.id for comment in collection_comments]
    comment_vote_map = {
        item['comment_id']: item['vote']
        for item in Vote.objects.filter(
            user=user,
            comment_id__in=comment_ids,
            post__isnull=True,
        ).values('comment_id', 'vote')
    }

    current_user_vote = (
        1
        if Vote.objects.filter(collection=collection, user=user, post__isnull=True, comment__isnull=True).exists()
        else 0
    )
    is_bookmarked = Bookmark.objects.filter(user=user, collection=collection, post__isnull=True).exists()

    posts_payload = [_collection_post_payload(item.post, sequence_number=item.sequence_number) for item in collection_posts]

    comments_payload = [
        _collection_comment_payload(
            comment,
            user_name=comment.user.name,
            current_user_vote=comment_vote_map.get(comment.id, 0),
        )
        for comment in collection_comments
    ]

    output = CollectionDetailOutputSerializer(
        data=_collection_detail_payload(
            collection,
            posts_payload=posts_payload,
            comments_payload=comments_payload,
            current_user_vote=current_user_vote,
            is_bookmarked=is_bookmarked,
        )
    )
    output.is_valid(raise_exception=True)
    return Response(output.data, status=status.HTTP_200_OK)


# Add the current user's upvote for a collection and update its aggregate vote total.
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upvote_collection(request, collection_id):
    user = request.user

    try:
        collection = Collection.objects.select_related('team').get(id=collection_id)
    except Collection.DoesNotExist:
        return Response({'error': 'Collection not found'}, status=status.HTTP_404_NOT_FOUND)

    membership_error = ensure_team_membership(team=collection.team, user=user)
    if membership_error:
        return membership_error

    with transaction.atomic():
        _, created = Vote.objects.get_or_create(
            collection=collection,
            user=user,
            post=None,
            comment=None,
            defaults={'vote': 1},
        )
        if created:
            Collection.objects.filter(id=collection.id).update(vote_count=F('vote_count') + 1)

    collection.refresh_from_db(fields=['vote_count'])
    return _collection_vote_response(collection=collection, vote=1)


# Remove the current user's upvote for a collection and update its aggregate vote total.
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def remove_collection_upvote(request, collection_id):
    user = request.user

    try:
        collection = Collection.objects.select_related('team').get(id=collection_id)
    except Collection.DoesNotExist:
        return Response({'error': 'Collection not found'}, status=status.HTTP_404_NOT_FOUND)

    membership_error = ensure_team_membership(team=collection.team, user=user)
    if membership_error:
        return membership_error

    with transaction.atomic():
        deleted_count, _ = Vote.objects.filter(
            collection=collection,
            user=user,
            post__isnull=True,
            comment__isnull=True,
        ).delete()
        if deleted_count > 0:
            Collection.objects.filter(id=collection.id).update(vote_count=F('vote_count') - 1)

    collection.refresh_from_db(fields=['vote_count'])
    return _collection_vote_response(collection=collection, vote=0)


# Create a comment on a collection and return the new comment payload for immediate display.
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_collection_comment(request, collection_id):
    user = request.user

    try:
        collection = Collection.objects.select_related('team').get(id=collection_id)
    except Collection.DoesNotExist:
        return Response({'error': 'Collection not found'}, status=status.HTTP_404_NOT_FOUND)

    membership_error = ensure_team_membership(team=collection.team, user=user)
    if membership_error:
        return membership_error

    create_comment_serializer = CollectionCommentCreateSerializer(data=request.data)
    if not create_comment_serializer.is_valid():
        return Response(create_comment_serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    body = create_comment_serializer.validated_data['body']

    comment = Comment.objects.create(
        post=None,
        collection=collection,
        user=user,
        body=body,
    )

    output = CollectionCommentOutputSerializer(
        data=_collection_comment_payload(comment, user_name=user.name, current_user_vote=0)
    )
    output.is_valid(raise_exception=True)
    return Response(output.data, status=status.HTTP_201_CREATED)


# Search eligible team posts by title and mark which results are already in the collection.
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def search_posts_for_collection(request, collection_id):
    user = request.user

    try:
        collection = Collection.objects.select_related('team').get(id=collection_id)
    except Collection.DoesNotExist:
        return Response({'error': 'Collection not found'}, status=status.HTTP_404_NOT_FOUND)

    membership_error = ensure_team_membership(team=collection.team, user=user)
    if membership_error:
        return membership_error

    query = (request.query_params.get('q') or '').strip()
    if not query:
        return Response([], status=status.HTTP_200_OK)

    posts = (
        Post.objects.filter(
            team=collection.team,
            type__in=COLLECTION_ELIGIBLE_POST_TYPE_VALUES,
            delete_flag=False,
            title__icontains=query,
        )
        .select_related('user')
        .order_by('-created_at')[:COLLECTION_POST_SEARCH_LIMIT]
    )

    existing_ids = set(
        PostCollection.objects.filter(collection=collection, post_id__in=[post.id for post in posts]).values_list('post_id', flat=True)
    )

    data = [_collection_search_post_payload(post, already_added=post.id in existing_ids) for post in posts]

    output = CollectionSearchPostOutputSerializer(data=data, many=True)
    output.is_valid(raise_exception=True)
    return Response(output.data, status=status.HTTP_200_OK)


# Append an eligible post to the collection with the next sequence number (admin-only).
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def add_post_to_collection(request, collection_id):
    user = request.user

    try:
        collection = Collection.objects.select_related('team').get(id=collection_id)
    except Collection.DoesNotExist:
        return Response({'error': 'Collection not found'}, status=status.HTTP_404_NOT_FOUND)

    membership = get_team_membership(team=collection.team, user=user)
    admin_error = ensure_team_admin(
        membership=membership,
        error_message='Only team admins can add posts to collections',
    )
    if admin_error:
        return admin_error

    add_post_serializer = AddCollectionPostSerializer(data=request.data)
    if not add_post_serializer.is_valid():
        return Response(add_post_serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    post_id = add_post_serializer.validated_data['post_id']

    try:
        post = Post.objects.select_related('user').get(
            id=post_id,
            team=collection.team,
            type__in=COLLECTION_ELIGIBLE_POST_TYPE_VALUES,
            delete_flag=False,
        )
    except Post.DoesNotExist:
        return Response({'error': 'Post not found'}, status=status.HTTP_404_NOT_FOUND)

    with transaction.atomic():
        Collection.objects.select_for_update().filter(id=collection.id).first()

        if PostCollection.objects.filter(collection=collection, post=post).exists():
            return Response({'error': 'Post already added to this collection'}, status=status.HTTP_400_BAD_REQUEST)

        max_sequence = PostCollection.objects.filter(collection=collection).aggregate(max_value=Max('sequence_number'))
        next_sequence = (max_sequence.get('max_value') or 0) + 1

        try:
            post_collection = PostCollection.objects.create(
                collection=collection,
                post=post,
                sequence_number=next_sequence,
            )
        except IntegrityError:
            return Response({'error': 'Could not add post to collection. Please retry.'}, status=status.HTTP_409_CONFLICT)

    output = CollectionPostOutputSerializer(
        data=_collection_post_payload(post, sequence_number=post_collection.sequence_number)
    )
    output.is_valid(raise_exception=True)
    return Response(output.data, status=status.HTTP_201_CREATED)
