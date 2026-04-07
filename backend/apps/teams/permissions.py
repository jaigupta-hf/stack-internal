from rest_framework import status
from rest_framework.response import Response

from .models import TeamUser


def team_membership_error_response():
    return Response({'error': 'You are not a member of this team'}, status=status.HTTP_403_FORBIDDEN)


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


def ensure_team_membership(**membership_filter):
    if TeamUser.objects.filter(**membership_filter).exists():
        return None
    return team_membership_error_response()


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


def ensure_team_admin(*, membership, error_message='Only team admins can manage users'):
    if membership is None:
        return team_membership_error_response()

    if membership.is_admin:
        return None

    return Response({'error': error_message}, status=status.HTTP_403_FORBIDDEN)
