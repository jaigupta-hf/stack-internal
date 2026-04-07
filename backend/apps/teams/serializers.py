from rest_framework import serializers
from .models import Team


class TeamSerializer(serializers.ModelSerializer):
    class Meta:
        model = Team
        fields = ['id', 'name', 'url_endpoint']
        read_only_fields = ['id']


class TeamListItemOutputSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    url_endpoint = serializers.CharField()
    is_admin = serializers.BooleanField()


class TeamBySlugOutputSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    url_endpoint = serializers.CharField()
    is_member = serializers.BooleanField()
    is_admin = serializers.BooleanField()


class TeamJoinOutputSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    url_endpoint = serializers.CharField()
    is_member = serializers.BooleanField()
    is_admin = serializers.BooleanField()
    already_member = serializers.BooleanField()


class TeamUserOutputSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    email = serializers.EmailField()
    is_admin = serializers.BooleanField()
    joined_at = serializers.DateTimeField()


class TeamUsersPaginationSerializer(serializers.Serializer):
    page = serializers.IntegerField()
    page_size = serializers.IntegerField()
    total_items = serializers.IntegerField()
    total_pages = serializers.IntegerField()
    has_next = serializers.BooleanField()
    has_previous = serializers.BooleanField()


class TeamUsersListOutputSerializer(serializers.Serializer):
    items = TeamUserOutputSerializer(many=True)
    pagination = TeamUsersPaginationSerializer()


class TeamUserRoleOutputSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    is_admin = serializers.BooleanField()


class TeamUserRemovedOutputSerializer(serializers.Serializer):
    removed_user_id = serializers.IntegerField()
