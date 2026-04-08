from rest_framework import serializers

from comments.models import Comment
from posts.constants import POST_TYPE_TO_LABEL
from posts.models import Post
from teams.models import Team

from .models import Collection, PostCollection


class CreateCollectionSerializer(serializers.Serializer):
    team_id = serializers.PrimaryKeyRelatedField(queryset=Team.objects.all(), source='team')
    title = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False, allow_blank=True, default='')


class CollectionPaginationSerializer(serializers.Serializer):
    page = serializers.IntegerField()
    page_size = serializers.IntegerField()
    total_items = serializers.IntegerField()
    total_pages = serializers.IntegerField()
    has_next = serializers.BooleanField()
    has_previous = serializers.BooleanField()


class CollectionSummaryOutputSerializer(serializers.ModelSerializer):
    team = serializers.IntegerField(source='team_id', read_only=True)
    user = serializers.IntegerField(source='user_id', read_only=True)
    user_name = serializers.SerializerMethodField()
    post_count = serializers.SerializerMethodField()

    class Meta:
        model = Collection
        fields = [
            'id',
            'title',
            'description',
            'team',
            'user',
            'user_name',
            'created_at',
            'modified_at',
            'views_count',
            'post_count',
            'bookmarks_count',
        ]

    def get_user_name(self, obj):
        return obj.user.name

    def get_post_count(self, obj):
        if 'post_count' in self.context:
            return self.context['post_count']

        annotated = getattr(obj, 'post_count', None)
        if annotated is not None:
            return annotated

        return obj.post_collections.count()


class CollectionListOutputSerializer(serializers.Serializer):
    items = CollectionSummaryOutputSerializer(many=True)
    pagination = CollectionPaginationSerializer()


class CollectionPostOutputSerializer(serializers.ModelSerializer):
    post_id = serializers.IntegerField(read_only=True)
    type = serializers.IntegerField(source='post.type', read_only=True)
    type_label = serializers.SerializerMethodField()
    title = serializers.CharField(source='post.title', read_only=True)
    user_name = serializers.SerializerMethodField()
    created_at = serializers.DateTimeField(source='post.created_at', read_only=True)

    class Meta:
        model = PostCollection
        fields = [
            'post_id',
            'type',
            'type_label',
            'title',
            'sequence_number',
            'user_name',
            'created_at',
        ]

    def get_type_label(self, obj):
        return POST_TYPE_TO_LABEL.get(obj.post.type, 'Post')

    def get_user_name(self, obj):
        return obj.post.user.name


class CollectionCommentOutputSerializer(serializers.ModelSerializer):
    collection_id = serializers.IntegerField(read_only=True)
    user = serializers.IntegerField(source='user_id', read_only=True)
    user_name = serializers.SerializerMethodField()
    parent_comment = serializers.IntegerField(source='parent_comment_id', allow_null=True, read_only=True)
    current_user_vote = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = [
            'id',
            'collection_id',
            'body',
            'created_at',
            'modified_at',
            'user',
            'user_name',
            'vote_count',
            'parent_comment',
            'current_user_vote',
        ]

    def get_user_name(self, obj):
        return obj.user.name

    def get_current_user_vote(self, obj):
        vote_map = self.context.get('comment_vote_map') or {}
        return vote_map.get(obj.id, 0)


class CollectionDetailOutputSerializer(serializers.ModelSerializer):
    team = serializers.IntegerField(source='team_id', read_only=True)
    user = serializers.IntegerField(source='user_id', read_only=True)
    user_name = serializers.SerializerMethodField()
    post_count = serializers.SerializerMethodField()
    current_user_vote = serializers.SerializerMethodField()
    is_bookmarked = serializers.SerializerMethodField()
    posts = serializers.SerializerMethodField()
    comments = serializers.SerializerMethodField()

    class Meta:
        model = Collection
        fields = [
            'id',
            'title',
            'description',
            'team',
            'user',
            'user_name',
            'created_at',
            'modified_at',
            'views_count',
            'post_count',
            'vote_count',
            'bookmarks_count',
            'current_user_vote',
            'is_bookmarked',
            'posts',
            'comments',
        ]

    def get_user_name(self, obj):
        return obj.user.name

    def _collection_posts(self, obj):
        posts = self.context.get('collection_posts')
        if posts is not None:
            return posts

        return (
            PostCollection.objects.filter(collection=obj)
            .select_related('post', 'post__user')
            .order_by('sequence_number', 'id')
        )

    def _collection_comments(self, obj):
        comments = self.context.get('collection_comments')
        if comments is not None:
            return comments

        return (
            Comment.objects.filter(collection=obj)
            .select_related('user')
            .order_by('created_at', 'id')
        )

    def get_post_count(self, obj):
        post_count = self.context.get('post_count')
        if post_count is not None:
            return post_count
        return len(self._collection_posts(obj))

    def get_current_user_vote(self, obj):
        if 'current_user_vote' in self.context:
            return self.context['current_user_vote']

        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return 0
        return 1 if obj.votes.filter(user=request.user, post__isnull=True, comment__isnull=True).exists() else 0

    def get_is_bookmarked(self, obj):
        if 'is_bookmarked' in self.context:
            return self.context['is_bookmarked']

        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return obj.bookmarks.filter(user=request.user, post__isnull=True).exists()

    def get_posts(self, obj):
        return CollectionPostOutputSerializer(self._collection_posts(obj), many=True, context=self.context).data

    def get_comments(self, obj):
        return CollectionCommentOutputSerializer(self._collection_comments(obj), many=True, context=self.context).data


class CollectionVoteOutputSerializer(serializers.ModelSerializer):
    collection_id = serializers.IntegerField(source='id', read_only=True)
    vote = serializers.SerializerMethodField()

    class Meta:
        model = Collection
        fields = ['collection_id', 'vote', 'vote_count']

    def get_vote(self, obj):
        return self.context.get('vote', 0)


class CollectionCommentCreateSerializer(serializers.Serializer):
    body = serializers.CharField()

    def validate_body(self, value):
        cleaned = str(value).strip()
        if not cleaned:
            raise serializers.ValidationError('body cannot be empty')
        return cleaned


class CollectionSearchPostOutputSerializer(serializers.ModelSerializer):
    type_label = serializers.SerializerMethodField()
    user_name = serializers.SerializerMethodField()
    already_added = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = ['id', 'type', 'type_label', 'title', 'user_name', 'created_at', 'already_added']

    def get_type_label(self, obj):
        return POST_TYPE_TO_LABEL.get(obj.type, 'Post')

    def get_user_name(self, obj):
        return obj.user.name

    def get_already_added(self, obj):
        existing_ids = self.context.get('existing_ids') or set()
        return obj.id in existing_ids


class AddCollectionPostSerializer(serializers.Serializer):
    post_id = serializers.IntegerField()
