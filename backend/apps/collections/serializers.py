from rest_framework import serializers
from teams.models import Team


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


class CollectionSummaryOutputSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    title = serializers.CharField()
    description = serializers.CharField()
    team = serializers.IntegerField()
    user = serializers.IntegerField()
    user_name = serializers.CharField()
    created_at = serializers.DateTimeField()
    modified_at = serializers.DateTimeField()
    views_count = serializers.IntegerField()
    post_count = serializers.IntegerField()
    bookmarks_count = serializers.IntegerField()


class CollectionListOutputSerializer(serializers.Serializer):
    items = CollectionSummaryOutputSerializer(many=True)
    pagination = CollectionPaginationSerializer()


class CollectionPostOutputSerializer(serializers.Serializer):
    post_id = serializers.IntegerField()
    type = serializers.IntegerField()
    type_label = serializers.CharField()
    title = serializers.CharField()
    sequence_number = serializers.IntegerField()
    user_name = serializers.CharField()
    created_at = serializers.DateTimeField()


class CollectionCommentOutputSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    collection_id = serializers.IntegerField()
    body = serializers.CharField()
    created_at = serializers.DateTimeField()
    modified_at = serializers.DateTimeField()
    user = serializers.IntegerField()
    user_name = serializers.CharField()
    vote_count = serializers.IntegerField()
    parent_comment = serializers.IntegerField(allow_null=True)
    current_user_vote = serializers.IntegerField()


class CollectionDetailOutputSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    title = serializers.CharField()
    description = serializers.CharField()
    team = serializers.IntegerField()
    user = serializers.IntegerField()
    user_name = serializers.CharField()
    created_at = serializers.DateTimeField()
    modified_at = serializers.DateTimeField()
    views_count = serializers.IntegerField()
    post_count = serializers.IntegerField()
    vote_count = serializers.IntegerField()
    bookmarks_count = serializers.IntegerField()
    current_user_vote = serializers.IntegerField()
    is_bookmarked = serializers.BooleanField()
    posts = CollectionPostOutputSerializer(many=True)
    comments = CollectionCommentOutputSerializer(many=True)


class CollectionVoteOutputSerializer(serializers.Serializer):
    collection_id = serializers.IntegerField()
    vote = serializers.IntegerField()
    vote_count = serializers.IntegerField()


class CollectionCommentCreateSerializer(serializers.Serializer):
    body = serializers.CharField()

    def validate_body(self, value):
        cleaned = str(value).strip()
        if not cleaned:
            raise serializers.ValidationError('body cannot be empty')
        return cleaned


class CollectionSearchPostOutputSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    type = serializers.IntegerField()
    type_label = serializers.CharField()
    title = serializers.CharField()
    user_name = serializers.CharField()
    created_at = serializers.DateTimeField()
    already_added = serializers.BooleanField()


class AddCollectionPostSerializer(serializers.Serializer):
    post_id = serializers.IntegerField()
