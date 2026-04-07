from rest_framework import serializers
from .models import Team
from .permissions import get_team_membership


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


class TeamBySlugOutputSerializer(serializers.ModelSerializer):
    is_member = serializers.SerializerMethodField()
    is_admin = serializers.SerializerMethodField()

    class Meta:
        model = Team
        fields = ['id', 'name', 'url_endpoint', 'is_member', 'is_admin']

    def _membership(self, team):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if not user or not getattr(user, 'is_authenticated', False):
            return None
        return get_team_membership(team=team, user=user)

    def get_is_member(self, team):
        return self._membership(team) is not None

    def get_is_admin(self, team):
        membership = self._membership(team)
        return bool(membership and membership.is_admin)


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
