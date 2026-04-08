from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.pagination import parse_pagination_params, paginate_queryset

from .models import Team, TeamUser
from .permissions import IsTeamAdmin, IsTeamMember, get_team_membership
from .serializers import (
    TeamBySlugOutputSerializer,
    TeamJoinOutputSerializer,
    TeamListItemOutputSerializer,
    TeamSerializer,
    TeamUserRemovedOutputSerializer,
    TeamUserRoleOutputSerializer,
    TeamUsersListOutputSerializer,
)


# Fetch a team by id and return a consistent 404 response when it does not exist.
def _get_team_or_404(team_id):
    try:
        return Team.objects.get(id=team_id), None
    except Team.DoesNotExist:
        return None, Response({'error': 'Team not found'}, status=status.HTTP_404_NOT_FOUND)

# Load the target team membership record or return a uniform not-found response.
def _get_target_membership_or_404(*, team, user_id, select_related_user=False):
    target_membership = get_team_membership(
        team=team,
        user_id=user_id,
        select_related_user=select_related_user,
    )
    if not target_membership:
        return None, Response({'error': 'User is not a member of this team'}, status=status.HTTP_404_NOT_FOUND)
    return target_membership, None


# Prevent role changes/removals that would leave the team without any admin users.
def _ensure_not_last_admin(team, user_id):
    remaining_admins = TeamUser.objects.filter(team=team, is_admin=True).exclude(user_id=user_id).count()
    if remaining_admins == 0:
        return Response({'error': 'Team must have at least one admin'}, status=status.HTTP_400_BAD_REQUEST)
    return None


# List joined teams (GET) or create a team and assign creator as admin (POST) with DRF generic routing.
class TeamsListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = TeamSerializer

    def get_queryset(self):
        return TeamUser.objects.filter(user=self.request.user).select_related('team').order_by('team__name')

    def list(self, request, *args, **kwargs):
        memberships = self.get_queryset()
        output = TeamListItemOutputSerializer(memberships, many=True)
        return Response(output.data, status=status.HTTP_200_OK)

    def perform_create(self, serializer):
        team = serializer.save()
        TeamUser.objects.create(team=team, user=self.request.user, is_admin=True)


class TeamScopedAPIView(APIView):
    """Shared team-id resolution for class-based permission checks."""

    def get_team_id_for_permission(self, request):
        team_id = self.kwargs.get('team_id')
        if team_id in (None, ''):
            return None
        return team_id if Team.objects.filter(id=team_id).exists() else None


class TeamBySlugView(APIView):
    """Resolve team by slug and include membership flags for requester."""

    permission_classes = [IsAuthenticated]

    def get(self, request, url_endpoint, *args, **kwargs):
        try:
            team = Team.objects.get(url_endpoint=url_endpoint)
        except Team.DoesNotExist:
            return Response({'error': 'Team not found'}, status=status.HTTP_404_NOT_FOUND)

        output = TeamBySlugOutputSerializer(team, context={'request': request})
        return Response(output.data, status=status.HTTP_200_OK)


class TeamJoinView(APIView):
    """Join team endpoint for authenticated users."""

    permission_classes = [IsAuthenticated]

    def post(self, request, team_id, *args, **kwargs):
        user = request.user

        try:
            team = Team.objects.get(id=team_id)
        except Team.DoesNotExist:
            return Response({'error': 'Team not found'}, status=status.HTTP_404_NOT_FOUND)

        membership = get_team_membership(team=team, user=user)
        if membership:
            output = TeamJoinOutputSerializer(team, context={'membership': membership, 'already_member': True})
            return Response(output.data, status=status.HTTP_200_OK)

        new_membership = TeamUser.objects.create(team=team, user=user, is_admin=False)

        output = TeamJoinOutputSerializer(team, context={'membership': new_membership, 'already_member': False})
        return Response(output.data, status=status.HTTP_201_CREATED)


class TeamUsersView(TeamScopedAPIView):
    """Return paginated member list for a team."""

    permission_classes = [IsAuthenticated, IsTeamMember]

    def get(self, request, team_id, *args, **kwargs):
        user = request.user

        try:
            team = Team.objects.get(id=team_id)
        except Team.DoesNotExist:
            return Response({'error': 'Team not found'}, status=status.HTTP_404_NOT_FOUND)

        page, page_size = parse_pagination_params(request)

        members = (
            TeamUser.objects.filter(team=team)
            .select_related('user')
            .order_by('-is_admin', 'user__name')
        )
        members, pagination = paginate_queryset(members, page=page, page_size=page_size)

        output = TeamUsersListOutputSerializer({'items': members, 'pagination': pagination})
        return Response(output.data, status=status.HTTP_200_OK)


class TeamUserMakeAdminView(TeamScopedAPIView):
    """Promote a team member to admin."""

    permission_classes = [IsAuthenticated, IsTeamAdmin]

    def post(self, request, team_id, user_id, *args, **kwargs):
        team, team_error = _get_team_or_404(team_id)
        if team_error:
            return team_error

        target_membership, target_error = _get_target_membership_or_404(
            team=team,
            user_id=user_id,
            select_related_user=True,
        )
        if target_error:
            return target_error

        if not target_membership.is_admin:
            target_membership.is_admin = True
            target_membership.save(update_fields=['is_admin'])

        output = TeamUserRoleOutputSerializer(target_membership)
        return Response(output.data, status=status.HTTP_200_OK)


class TeamUserMakeMemberView(TeamScopedAPIView):
    """Demote an admin back to member while preserving at least one admin."""

    permission_classes = [IsAuthenticated, IsTeamAdmin]

    def post(self, request, team_id, user_id, *args, **kwargs):
        team, team_error = _get_team_or_404(team_id)
        if team_error:
            return team_error

        target_membership, target_error = _get_target_membership_or_404(
            team=team,
            user_id=user_id,
            select_related_user=True,
        )
        if target_error:
            return target_error

        if target_membership.is_admin:
            last_admin_error = _ensure_not_last_admin(team, user_id)
            if last_admin_error:
                return last_admin_error

            target_membership.is_admin = False
            target_membership.save(update_fields=['is_admin'])

        output = TeamUserRoleOutputSerializer(target_membership)
        return Response(output.data, status=status.HTTP_200_OK)


class TeamUserRemoveView(TeamScopedAPIView):
    """Remove a member from a team with admin and safety checks."""

    permission_classes = [IsAuthenticated, IsTeamAdmin]

    def post(self, request, team_id, user_id, *args, **kwargs):
        user = request.user

        team, team_error = _get_team_or_404(team_id)
        if team_error:
            return team_error

        if int(user_id) == user.id:
            return Response({'error': 'You cannot remove yourself from the team'}, status=status.HTTP_400_BAD_REQUEST)

        target_membership, target_error = _get_target_membership_or_404(team=team, user_id=user_id)
        if target_error:
            return target_error

        if target_membership.is_admin:
            last_admin_error = _ensure_not_last_admin(team, user_id)
            if last_admin_error:
                return last_admin_error

        target_membership.delete()

        output = TeamUserRemovedOutputSerializer(data={'removed_user_id': int(user_id)})
        output.is_valid(raise_exception=True)
        return Response(output.data, status=status.HTTP_200_OK)
