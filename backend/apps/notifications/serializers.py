from rest_framework import serializers

from .models import Notification


class TeamIdInputSerializer(serializers.Serializer):
    team_id = serializers.IntegerField()


class NotificationItemSerializer(serializers.ModelSerializer):
    triggered_by_name = serializers.CharField(source='triggered_by.name', read_only=True)
    post_title = serializers.CharField(source='post.title', read_only=True, allow_blank=True)
    post_type = serializers.IntegerField(source='post.type', read_only=True)
    post_delete_flag = serializers.BooleanField(source='post.delete_flag', read_only=True)
    parent_post_id = serializers.IntegerField(source='post.parent_id', read_only=True, allow_null=True)

    class Meta:
        model = Notification
        fields = [
            'id',
            'post_id',
            'user_id',
            'triggered_by_id',
            'triggered_by_name',
            'reason',
            'created_at',
            'is_read',
            'post_title',
            'post_type',
            'post_delete_flag',
            'parent_post_id',
        ]


class NotificationListSerializer(serializers.Serializer):
    unread_count = serializers.IntegerField()
    items = NotificationItemSerializer(many=True)


class NotificationReadStateSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    is_read = serializers.BooleanField()


class NotificationMarkAllReadSerializer(serializers.Serializer):
    updated_count = serializers.IntegerField()
