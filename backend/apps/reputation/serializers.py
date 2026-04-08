from rest_framework import serializers

from .models import ReputationHistory


class ReputationHistoryQuerySerializer(serializers.Serializer):
    team_id = serializers.IntegerField()
    user_id = serializers.IntegerField(required=False)


class ReputationPaginationOutputSerializer(serializers.Serializer):
    page = serializers.IntegerField()
    page_size = serializers.IntegerField()
    total_items = serializers.IntegerField()
    total_pages = serializers.IntegerField()
    has_next = serializers.BooleanField()
    has_previous = serializers.BooleanField()


class ReputationHistoryItemOutputSerializer(serializers.ModelSerializer):
    triggered_by_id = serializers.IntegerField(read_only=True)
    post_id = serializers.IntegerField(read_only=True)
    post_title = serializers.CharField(source='post.title', read_only=True)
    post_type = serializers.IntegerField(source='post.type', read_only=True)
    reference_type = serializers.SerializerMethodField()
    reference_post_id = serializers.SerializerMethodField()

    class Meta:
        model = ReputationHistory
        fields = [
            'id',
            'points',
            'reason',
            'created_at',
            'triggered_by_id',
            'post_id',
            'post_title',
            'post_type',
            'reference_type',
            'reference_post_id',
        ]

    def get_reference_type(self, obj):
        return 'article' if obj.post.type >= 20 else 'question'

    def get_reference_post_id(self, obj):
        if obj.post.type == 1 and obj.post.parent_id:
            return obj.post.parent_id
        return obj.post_id


class ReputationHistoryGroupOutputSerializer(serializers.Serializer):
    date = serializers.CharField()
    total_points = serializers.IntegerField()
    items = ReputationHistoryItemOutputSerializer(many=True)


class ReputationHistoryOutputSerializer(serializers.Serializer):
    user_id = serializers.IntegerField()
    groups = ReputationHistoryGroupOutputSerializer(many=True)
    pagination = ReputationPaginationOutputSerializer()
