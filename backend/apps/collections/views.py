from django.db import IntegrityError, transaction
from django.db.models import Count, F, Max
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.pagination import CustomPagination
from comments.models import Comment
from posts.constants import COLLECTION_ELIGIBLE_POST_TYPE_VALUES, COLLECTION_POST_SEARCH_LIMIT
from posts.models import Bookmark, Post
from teams.permissions import IsTeamAdmin, IsTeamMember
from votes.models import Vote

from .models import Collection, PostCollection
from .serializers import (
    AddCollectionPostSerializer,
    CollectionCommentCreateSerializer,
    CollectionCommentOutputSerializer,
    CollectionDetailOutputSerializer,
    CollectionPostOutputSerializer,
    CollectionSearchPostOutputSerializer,
    CollectionSummaryOutputSerializer,
    CollectionVoteOutputSerializer,
    CreateCollectionSerializer,
)


def _collection_vote_response(*, collection, vote):
    serializer = CollectionVoteOutputSerializer(collection, context={'vote': vote})
    return Response(serializer.data, status=status.HTTP_200_OK)


class CollectionViewSet(viewsets.GenericViewSet):
    """CBV endpoints for collection CRUD and collection actions."""

    permission_classes = [IsAuthenticated, IsTeamMember]
    http_method_names = ['get', 'post', 'head', 'options']

    def get_permissions(self):
        permissions = [IsAuthenticated(), IsTeamMember()]
        if self.action in ('create', 'add_post'):
            permissions.append(IsTeamAdmin())
        return permissions

    def get_team_id_for_permission(self, request):
        if self.action == 'list':
            return request.query_params.get('team_id')

        if self.action == 'create':
            return request.data.get('team_id')

        lookup_pk = self.kwargs.get('pk')
        if lookup_pk in (None, ''):
            return None

        return Collection.objects.filter(id=lookup_pk).values_list('team_id', flat=True).first()

    def _get_collection_for_detail_or_response(self, collection_id):
        try:
            collection = Collection.objects.select_related('user', 'team').get(id=collection_id)
            return collection, None
        except Collection.DoesNotExist:
            return None, Response({'error': 'Collection not found'}, status=status.HTTP_404_NOT_FOUND)

    def create(self, request, *args, **kwargs):
        serializer = CreateCollectionSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        validated = serializer.validated_data
        collection = Collection.objects.create(
            title=validated['title'].strip(),
            description=validated.get('description', '').strip(),
            team=validated['team'],
            user=request.user,
        )

        output = CollectionSummaryOutputSerializer(collection, context={'post_count': 0})
        return Response(output.data, status=status.HTTP_201_CREATED)

    def list(self, request, *args, **kwargs):
        team_id = request.query_params.get('team_id')
        if not team_id:
            return Response({'error': 'team_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        collections = (
            Collection.objects.filter(team_id=team_id)
            .select_related('user')
            .annotate(post_count=Count('post_collections'))
            .order_by('-created_at')
        )

        paginator = CustomPagination()
        paged_collections = paginator.paginate_queryset(collections, request, view=self)
        output = CollectionSummaryOutputSerializer(paged_collections, many=True)
        return paginator.get_paginated_response(output.data)

    def retrieve(self, request, pk=None, *args, **kwargs):
        collection, collection_error = self._get_collection_for_detail_or_response(pk)
        if collection_error:
            return collection_error

        Collection.objects.filter(id=collection.id).update(views_count=F('views_count') + 1)
        collection.refresh_from_db(fields=['views_count'])

        collection_posts = list(
            PostCollection.objects.filter(collection=collection)
            .select_related('post', 'post__user')
            .order_by('sequence_number', 'id')
        )
        collection_comments = list(
            Comment.objects.filter(collection=collection)
            .select_related('user')
            .order_by('created_at', 'id')
        )

        comment_ids = [comment.id for comment in collection_comments]
        comment_vote_map = {
            item['comment_id']: item['vote']
            for item in Vote.objects.filter(
                user=request.user,
                comment_id__in=comment_ids,
                post__isnull=True,
            ).values('comment_id', 'vote')
        }

        current_user_vote = (
            1
            if Vote.objects.filter(collection=collection, user=request.user, post__isnull=True, comment__isnull=True).exists()
            else 0
        )
        is_bookmarked = Bookmark.objects.filter(user=request.user, collection=collection, post__isnull=True).exists()

        output = CollectionDetailOutputSerializer(
            collection,
            context={
                'request': request,
                'collection_posts': collection_posts,
                'collection_comments': collection_comments,
                'comment_vote_map': comment_vote_map,
                'current_user_vote': current_user_vote,
                'is_bookmarked': is_bookmarked,
                'post_count': len(collection_posts),
            },
        )
        return Response(output.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='upvote')
    def upvote(self, request, pk=None, *args, **kwargs):
        collection, collection_error = self._get_collection_for_detail_or_response(pk)
        if collection_error:
            return collection_error

        with transaction.atomic():
            _, created = Vote.objects.get_or_create(
                collection=collection,
                user=request.user,
                post=None,
                comment=None,
                defaults={'vote': 1},
            )
            if created:
                Collection.objects.filter(id=collection.id).update(vote_count=F('vote_count') + 1)

        collection.refresh_from_db(fields=['vote_count'])
        return _collection_vote_response(collection=collection, vote=1)

    @action(detail=True, methods=['post'], url_path='upvote/remove')
    def remove_upvote(self, request, pk=None, *args, **kwargs):
        collection, collection_error = self._get_collection_for_detail_or_response(pk)
        if collection_error:
            return collection_error

        with transaction.atomic():
            deleted_count, _ = Vote.objects.filter(
                collection=collection,
                user=request.user,
                post__isnull=True,
                comment__isnull=True,
            ).delete()
            if deleted_count > 0:
                Collection.objects.filter(id=collection.id).update(vote_count=F('vote_count') - 1)

        collection.refresh_from_db(fields=['vote_count'])
        return _collection_vote_response(collection=collection, vote=0)

    @action(detail=True, methods=['post'], url_path='comments')
    def create_comment(self, request, pk=None, *args, **kwargs):
        collection, collection_error = self._get_collection_for_detail_or_response(pk)
        if collection_error:
            return collection_error

        create_comment_serializer = CollectionCommentCreateSerializer(data=request.data)
        if not create_comment_serializer.is_valid():
            return Response(create_comment_serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        comment = Comment.objects.create(
            post=None,
            collection=collection,
            user=request.user,
            body=create_comment_serializer.validated_data['body'],
        )

        output = CollectionCommentOutputSerializer(
            comment,
            context={'comment_vote_map': {comment.id: 0}},
        )
        return Response(output.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'], url_path='search-posts')
    def search_posts(self, request, pk=None, *args, **kwargs):
        collection, collection_error = self._get_collection_for_detail_or_response(pk)
        if collection_error:
            return collection_error

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

        output = CollectionSearchPostOutputSerializer(posts, many=True, context={'existing_ids': existing_ids})
        return Response(output.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='posts')
    def add_post(self, request, pk=None, *args, **kwargs):
        collection, collection_error = self._get_collection_for_detail_or_response(pk)
        if collection_error:
            return collection_error

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

        output = CollectionPostOutputSerializer(post_collection)
        return Response(output.data, status=status.HTTP_201_CREATED)
