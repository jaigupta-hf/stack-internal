from rest_framework.permissions import BasePermission

from teams.models import TeamUser


class IsPostAuthor(BasePermission):
    message = 'Only the post author can perform this action'

    def has_object_permission(self, request, view, obj):
        return getattr(obj, 'user_id', None) == request.user.id


class IsPostAuthorOrTeamAdmin(BasePermission):
    message = 'Only the post author or team admin can perform this action'

    def has_object_permission(self, request, view, obj):
        if getattr(obj, 'user_id', None) == request.user.id:
            return True

        team = getattr(obj, 'team', None)
        if team is None and getattr(obj, 'post', None) is not None:
            team = obj.post.team
        if team is None:
            return False

        return TeamUser.objects.filter(team=team, user=request.user, is_admin=True).exists()
