from rest_framework import serializers


class TeamIdInputSerializer(serializers.Serializer):
    team_id = serializers.IntegerField()


class NotificationItemOutputSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    post_id = serializers.IntegerField()
    user_id = serializers.IntegerField()
    triggered_by_id = serializers.IntegerField()
    triggered_by_name = serializers.CharField(allow_blank=True)
    reason = serializers.CharField(allow_blank=True)
    created_at = serializers.DateTimeField()
    is_read = serializers.BooleanField()
    post_title = serializers.CharField(allow_blank=True, allow_null=True)
    post_type = serializers.IntegerField()
    post_delete_flag = serializers.BooleanField()
    parent_post_id = serializers.IntegerField(allow_null=True)


class NotificationListOutputSerializer(serializers.Serializer):
    unread_count = serializers.IntegerField()
    items = NotificationItemOutputSerializer(many=True)


class NotificationReadStateOutputSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    is_read = serializers.BooleanField()


class NotificationMarkAllReadOutputSerializer(serializers.Serializer):
    updated_count = serializers.IntegerField()
