from rest_framework import serializers


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


class ReputationHistoryItemOutputSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    points = serializers.IntegerField()
    reason = serializers.CharField()
    created_at = serializers.DateTimeField()
    triggered_by_id = serializers.IntegerField()
    post_id = serializers.IntegerField()
    post_title = serializers.CharField()
    post_type = serializers.IntegerField()
    reference_type = serializers.CharField()
    reference_post_id = serializers.IntegerField()


class ReputationHistoryGroupOutputSerializer(serializers.Serializer):
    date = serializers.CharField()
    total_points = serializers.IntegerField()
    items = ReputationHistoryItemOutputSerializer(many=True)


class ReputationHistoryOutputSerializer(serializers.Serializer):
    user_id = serializers.IntegerField()
    groups = ReputationHistoryGroupOutputSerializer(many=True)
    pagination = ReputationPaginationOutputSerializer()
