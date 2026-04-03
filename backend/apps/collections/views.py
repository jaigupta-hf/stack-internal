from django.db import transaction
from django.db.models import Count, F, Max
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from apps.pagination import parse_pagination_params, paginate_queryset
from teams.models import TeamUser
from teams.utils import get_team_member_name
from posts.models import Post
from comments.models import Comment
from votes.models import Vote
from posts.models import Bookmark
from .models import Collection, PostCollection
from .serializers import CreateCollectionSerializer


POST_TYPE_TO_LABEL = {
    0: 'Question',
    20: 'Announcement',
    21: 'How-to Guide',
    22: 'Knowledge Article',
    23: 'Policy',
}


def _display_name(team_id, user_id):
    return get_team_member_name(team_id, user_id)


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

    membership = TeamUser.objects.filter(team=team, user=user).first()
    if not membership:
        return Response({'error': 'You are not a member of this team'}, status=status.HTTP_403_FORBIDDEN)

    if not membership.is_admin:
        return Response({'error': 'Only team admins can create collections'}, status=status.HTTP_403_FORBIDDEN)

    collection = Collection.objects.create(
        title=title,
        description=description,
        team=team,
        user=user,
    )

    return Response(
        {
            'id': collection.id,
            'title': collection.title,
            'description': collection.description,
            'team': collection.team_id,
            'user': collection.user_id,
            'user_name': _display_name(collection.team_id, user.id),
            'created_at': collection.created_at,
            'modified_at': collection.modified_at,
            'views_count': collection.views_count,
            'post_count': 0,
            'bookmarks_count': collection.bookmarks_count,
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_collections(request):
    user = request.user

    team_id = request.query_params.get('team_id')
    if not team_id:
        return Response({'error': 'team_id is required'}, status=status.HTTP_400_BAD_REQUEST)

    if not TeamUser.objects.filter(team_id=team_id, user=user).exists():
        return Response({'error': 'You are not a member of this team'}, status=status.HTTP_403_FORBIDDEN)

    page, page_size = parse_pagination_params(request)

    collections = (
        Collection.objects.filter(team_id=team_id)
        .select_related('user')
        .annotate(post_count=Count('post_collections'))
        .order_by('-created_at')
    )
    collections, pagination = paginate_queryset(collections, page=page, page_size=page_size)

    data = [
        {
            'id': collection.id,
            'title': collection.title,
            'description': collection.description,
            'team': collection.team_id,
            'user': collection.user_id,
            'user_name': _display_name(collection.team_id, collection.user_id),
            'created_at': collection.created_at,
            'modified_at': collection.modified_at,
            'views_count': collection.views_count,
            'post_count': collection.post_count,
            'bookmarks_count': collection.bookmarks_count,
        }
        for collection in collections
    ]

    return Response({'items': data, 'pagination': pagination}, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def collection_detail(request, collection_id):
    user = request.user

    try:
        collection = Collection.objects.select_related('user', 'team').get(id=collection_id)
    except Collection.DoesNotExist:
        return Response({'error': 'Collection not found'}, status=status.HTTP_404_NOT_FOUND)

    if not TeamUser.objects.filter(team=collection.team, user=user).exists():
        return Response({'error': 'You are not a member of this team'}, status=status.HTTP_403_FORBIDDEN)

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

    posts_payload = [
        {
            'post_id': item.post_id,
            'type': item.post.type,
            'type_label': POST_TYPE_TO_LABEL.get(item.post.type, 'Post'),
            'title': item.post.title,
            'sequence_number': item.sequence_number,
            'user_name': _display_name(collection.team_id, item.post.user_id),
            'created_at': item.post.created_at,
        }
        for item in collection_posts
    ]

    comments_payload = [
        {
            'id': comment.id,
            'collection_id': comment.collection_id,
            'body': comment.body,
            'created_at': comment.created_at,
            'modified_at': comment.modified_at,
            'user': comment.user_id,
            'user_name': _display_name(collection.team_id, comment.user_id),
            'vote_count': comment.vote_count,
            'parent_comment': comment.parent_comment_id,
            'current_user_vote': comment_vote_map.get(comment.id, 0),
        }
        for comment in collection_comments
    ]

    return Response(
        {
            'id': collection.id,
            'title': collection.title,
            'description': collection.description,
            'team': collection.team_id,
            'user': collection.user_id,
            'user_name': _display_name(collection.team_id, collection.user_id),
            'created_at': collection.created_at,
            'modified_at': collection.modified_at,
            'views_count': collection.views_count,
            'post_count': len(posts_payload),
            'vote_count': collection.vote_count,
            'bookmarks_count': collection.bookmarks_count,
            'current_user_vote': current_user_vote,
            'is_bookmarked': is_bookmarked,
            'posts': posts_payload,
            'comments': comments_payload,
        },
        status=status.HTTP_200_OK,
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upvote_collection(request, collection_id):
    user = request.user

    try:
        collection = Collection.objects.select_related('team').get(id=collection_id)
    except Collection.DoesNotExist:
        return Response({'error': 'Collection not found'}, status=status.HTTP_404_NOT_FOUND)

    if not TeamUser.objects.filter(team=collection.team, user=user).exists():
        return Response({'error': 'You are not a member of this team'}, status=status.HTTP_403_FORBIDDEN)

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

    return Response(
        {
            'collection_id': collection.id,
            'vote': 1,
            'vote_count': collection.vote_count,
        },
        status=status.HTTP_200_OK,
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def remove_collection_upvote(request, collection_id):
    user = request.user

    try:
        collection = Collection.objects.select_related('team').get(id=collection_id)
    except Collection.DoesNotExist:
        return Response({'error': 'Collection not found'}, status=status.HTTP_404_NOT_FOUND)

    if not TeamUser.objects.filter(team=collection.team, user=user).exists():
        return Response({'error': 'You are not a member of this team'}, status=status.HTTP_403_FORBIDDEN)

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

    return Response(
        {
            'collection_id': collection.id,
            'vote': 0,
            'vote_count': collection.vote_count,
        },
        status=status.HTTP_200_OK,
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_collection_comment(request, collection_id):
    user = request.user

    try:
        collection = Collection.objects.select_related('team').get(id=collection_id)
    except Collection.DoesNotExist:
        return Response({'error': 'Collection not found'}, status=status.HTTP_404_NOT_FOUND)

    if not TeamUser.objects.filter(team=collection.team, user=user).exists():
        return Response({'error': 'You are not a member of this team'}, status=status.HTTP_403_FORBIDDEN)

    body = str(request.data.get('body', '')).strip()
    if not body:
        return Response({'error': 'body cannot be empty'}, status=status.HTTP_400_BAD_REQUEST)

    comment = Comment.objects.create(
        post=None,
        collection=collection,
        user=user,
        body=body,
    )

    return Response(
        {
            'id': comment.id,
            'collection_id': comment.collection_id,
            'body': comment.body,
            'created_at': comment.created_at,
            'modified_at': comment.modified_at,
            'user': comment.user_id,
            'user_name': _display_name(collection.team_id, comment.user_id),
            'vote_count': comment.vote_count,
            'parent_comment': comment.parent_comment_id,
            'current_user_vote': 0,
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def search_posts_for_collection(request, collection_id):
    user = request.user

    try:
        collection = Collection.objects.select_related('team').get(id=collection_id)
    except Collection.DoesNotExist:
        return Response({'error': 'Collection not found'}, status=status.HTTP_404_NOT_FOUND)

    if not TeamUser.objects.filter(team=collection.team, user=user).exists():
        return Response({'error': 'You are not a member of this team'}, status=status.HTTP_403_FORBIDDEN)

    query = (request.query_params.get('q') or '').strip()
    if not query:
        return Response([], status=status.HTTP_200_OK)

    posts = (
        Post.objects.filter(
            team=collection.team,
            type__in=(0, 20, 21, 22, 23),
            delete_flag=False,
            title__icontains=query,
        )
        .select_related('user')
        .order_by('-created_at')[:20]
    )

    existing_ids = set(
        PostCollection.objects.filter(collection=collection, post_id__in=[post.id for post in posts]).values_list('post_id', flat=True)
    )

    data = [
        {
            'id': post.id,
            'type': post.type,
            'type_label': POST_TYPE_TO_LABEL.get(post.type, 'Post'),
            'title': post.title,
            'user_name': _display_name(collection.team_id, post.user_id),
            'created_at': post.created_at,
            'already_added': post.id in existing_ids,
        }
        for post in posts
    ]

    return Response(data, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def add_post_to_collection(request, collection_id):
    user = request.user

    try:
        collection = Collection.objects.select_related('team').get(id=collection_id)
    except Collection.DoesNotExist:
        return Response({'error': 'Collection not found'}, status=status.HTTP_404_NOT_FOUND)

    membership = TeamUser.objects.filter(team=collection.team, user=user).first()
    if not membership:
        return Response({'error': 'You are not a member of this team'}, status=status.HTTP_403_FORBIDDEN)

    if not membership.is_admin:
        return Response({'error': 'Only team admins can add posts to collections'}, status=status.HTTP_403_FORBIDDEN)

    post_id = request.data.get('post_id')
    if post_id is None:
        return Response({'error': 'post_id is required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        post = Post.objects.select_related('user').get(
            id=post_id,
            team=collection.team,
            type__in=(0, 20, 21, 22, 23),
            delete_flag=False,
        )
    except Post.DoesNotExist:
        return Response({'error': 'Post not found'}, status=status.HTTP_404_NOT_FOUND)

    if PostCollection.objects.filter(collection=collection, post=post).exists():
        return Response({'error': 'Post already added to this collection'}, status=status.HTTP_400_BAD_REQUEST)

    max_sequence = PostCollection.objects.filter(collection=collection).aggregate(max_value=Max('sequence_number'))
    next_sequence = (max_sequence.get('max_value') or 0) + 1

    post_collection = PostCollection.objects.create(
        collection=collection,
        post=post,
        sequence_number=next_sequence,
    )

    return Response(
        {
            'post_id': post_collection.post_id,
            'type': post.type,
            'type_label': POST_TYPE_TO_LABEL.get(post.type, 'Post'),
            'title': post.title,
            'sequence_number': post_collection.sequence_number,
            'user_name': _display_name(collection.team_id, post.user_id),
            'created_at': post.created_at,
        },
        status=status.HTTP_201_CREATED,
    )
