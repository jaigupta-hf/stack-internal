from rest_framework import status
from rest_framework.permissions import BasePermission
from rest_framework.response import Response

from .models import TeamUser


# Build a standard 403 response used when a user is outside the target team.
def team_membership_error_response():
    return Response({'error': 'You are not a member of this team'}, status=status.HTTP_403_FORBIDDEN)


# Fetch one TeamUser membership record with optional eager-loading for related team/user data.
def get_team_membership(*, user=None, select_related_team=False, select_related_user=False, **membership_filter):
    queryset = TeamUser.objects
    if select_related_team and select_related_user:
        queryset = queryset.select_related('team', 'user')
    elif select_related_team:
        queryset = queryset.select_related('team')
    elif select_related_user:
        queryset = queryset.select_related('user')

    if user is not None:
        membership_filter['user'] = user

    return queryset.filter(**membership_filter).first()


# Return None when membership exists, otherwise return the standard team-membership error response.
def ensure_team_membership(**membership_filter):
    if TeamUser.objects.filter(**membership_filter).exists():
        return None
    return team_membership_error_response()


# Fetch and return membership plus an error tuple so callers can branch without duplicate queries.
def ensure_team_membership_and_get(*, user, select_related_team=False, select_related_user=False, **membership_filter):
    membership = get_team_membership(
        user=user,
        select_related_team=select_related_team,
        select_related_user=select_related_user,
        **membership_filter,
    )
    if membership is None:
        return None, team_membership_error_response()
    return membership, None


# Enforce admin privileges for team management actions and return a caller-provided 403 message.
def ensure_team_admin(*, membership, error_message='Only team admins can manage users'):
    if membership is None:
        return team_membership_error_response()

    if membership.is_admin:
        return None

    return Response({'error': error_message}, status=status.HTTP_403_FORBIDDEN)


class IsTeamMemberFromRequest(BasePermission):
    """Checks team membership using a team id from query params or request body."""

    message = 'You are not a member of this team'

    # Validate membership using team id from request data/query params while deferring serializer-level validation.
    def has_permission(self, request, view):
        location = getattr(view, 'team_id_location', 'query_params')
        param_name = getattr(view, 'team_id_param', 'team_id')

        source = request.query_params if location == 'query_params' else request.data
        raw_team_id = source.get(param_name)

        # Defer required/format validation to the view serializer logic.
        if raw_team_id in (None, ''):
            return True

        try:
            team_id = int(raw_team_id)
        except (TypeError, ValueError):
            return True

        return TeamUser.objects.filter(team_id=team_id, user=request.user).exists()


class IsTeamMemberForNotification(BasePermission):
    """Object-level permission for Notification resources via related post team."""

    message = 'You are not a member of this team'

    # Allow access only when the user belongs to the notification's related post team.
    def has_object_permission(self, request, view, obj):
        return TeamUser.objects.filter(team=obj.post.team, user=request.user).exists()
