from rest_framework import serializers
from .models import Team, TeamUser
from .permissions import get_team_membership


class TeamSerializer(serializers.ModelSerializer):
    class Meta:
        model = Team
        fields = ['id', 'name', 'url_endpoint']
        read_only_fields = ['id']


class TeamListItemOutputSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source='team_id', read_only=True)
    name = serializers.CharField(source='team.name', read_only=True)
    url_endpoint = serializers.CharField(source='team.url_endpoint', read_only=True)

    class Meta:
        model = TeamUser
        fields = ['id', 'name', 'url_endpoint', 'is_admin']


class TeamBySlugOutputSerializer(serializers.ModelSerializer):
    is_member = serializers.SerializerMethodField()
    is_admin = serializers.SerializerMethodField()

    class Meta:
        model = Team
        fields = ['id', 'name', 'url_endpoint', 'is_member', 'is_admin']

    def _membership(self, team):
        if 'membership' in self.context:
            return self.context.get('membership')

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


class TeamJoinOutputSerializer(serializers.ModelSerializer):
    is_member = serializers.SerializerMethodField()
    is_admin = serializers.SerializerMethodField()
    already_member = serializers.SerializerMethodField()

    class Meta:
        model = Team
        fields = ['id', 'name', 'url_endpoint', 'is_member', 'is_admin', 'already_member']

    def get_is_member(self, obj):
        return True

    def get_is_admin(self, obj):
        membership = self.context.get('membership')
        return bool(membership and membership.is_admin)

    def get_already_member(self, obj):
        return bool(self.context.get('already_member', False))


class TeamUserOutputSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source='user_id', read_only=True)
    name = serializers.CharField(source='user.name', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)

    class Meta:
        model = TeamUser
        fields = ['id', 'name', 'email', 'is_admin', 'joined_at']


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


class TeamUserRoleOutputSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source='user_id', read_only=True)
    name = serializers.CharField(source='user.name', read_only=True)

    class Meta:
        model = TeamUser
        fields = ['id', 'name', 'is_admin']


class TeamUserRemovedOutputSerializer(serializers.Serializer):
    removed_user_id = serializers.IntegerField()
