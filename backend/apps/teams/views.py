from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.pagination import CustomPagination

from .models import Team
from .permissions import IsTeamAdmin, IsTeamMember, get_team_membership
from .services import TeamService, TeamServiceError
from .serializers import (
    TeamBySlugOutputSerializer,
    TeamJoinOutputSerializer,
    TeamListItemOutputSerializer,
    TeamSerializer,
    TeamUserOutputSerializer,
    TeamUserRemovedOutputSerializer,
    TeamUserRoleOutputSerializer,
)


# List joined teams (GET) or create a team and assign creator as admin (POST) with DRF generic routing.
class TeamsListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = TeamSerializer

    def get_queryset(self):
        return self.request.user.team_users.select_related('team').order_by('team__name')

    def list(self, request, *args, **kwargs):
        memberships = self.get_queryset()
        output = TeamListItemOutputSerializer(memberships, many=True)
        return Response(output.data, status=status.HTTP_200_OK)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        team = TeamService.create_team_with_creator(
            validated_data=serializer.validated_data,
            creator=request.user,
        )
        output = TeamSerializer(team)
        return Response(output.data, status=status.HTTP_201_CREATED)


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

        membership = get_team_membership(team=team, user=request.user)
        output = TeamBySlugOutputSerializer(team, context={'request': request, 'membership': membership})
        return Response(output.data, status=status.HTTP_200_OK)


class TeamJoinView(APIView):
    """Join team endpoint for authenticated users."""

    permission_classes = [IsAuthenticated]

    def post(self, request, team_id, *args, **kwargs):
        try:
            team, membership, already_member = TeamService.join_team(team_id=team_id, user=request.user)
        except TeamServiceError as error:
            return Response({'error': str(error)}, status=error.status_code)

        output = TeamJoinOutputSerializer(team, context={'membership': membership, 'already_member': already_member})
        return Response(
            output.data,
            status=status.HTTP_200_OK if already_member else status.HTTP_201_CREATED,
        )


class TeamUsersView(TeamScopedAPIView):
    """Return paginated member list for a team."""

    permission_classes = [IsAuthenticated, IsTeamMember]

    def get(self, request, team_id, *args, **kwargs):
        try:
            team = Team.objects.get(id=team_id)
        except Team.DoesNotExist:
            return Response({'error': 'Team not found'}, status=status.HTTP_404_NOT_FOUND)

        members = (
            team.team_users.filter()
            .select_related('user')
            .order_by('-is_admin', 'user__name')
        )
        paginator = CustomPagination()
        page = paginator.paginate_queryset(members, request, view=self)

        output = TeamUserOutputSerializer(page, many=True)
        return paginator.get_paginated_response(output.data)


class TeamUserMakeAdminView(TeamScopedAPIView):
    """Promote a team member to admin."""

    permission_classes = [IsAuthenticated, IsTeamAdmin]

    def post(self, request, team_id, user_id, *args, **kwargs):
        try:
            target_membership = TeamService.make_admin(team_id=team_id, user_id=user_id)
        except TeamServiceError as error:
            return Response({'error': str(error)}, status=error.status_code)

        output = TeamUserRoleOutputSerializer(target_membership)
        return Response(output.data, status=status.HTTP_200_OK)


class TeamUserMakeMemberView(TeamScopedAPIView):
    """Demote an admin back to member while preserving at least one admin."""

    permission_classes = [IsAuthenticated, IsTeamAdmin]

    def post(self, request, team_id, user_id, *args, **kwargs):
        try:
            target_membership = TeamService.make_member(team_id=team_id, user_id=user_id)
        except TeamServiceError as error:
            return Response({'error': str(error)}, status=error.status_code)

        output = TeamUserRoleOutputSerializer(target_membership)
        return Response(output.data, status=status.HTTP_200_OK)


class TeamUserRemoveView(TeamScopedAPIView):
    """Remove a member from a team with admin and safety checks."""

    permission_classes = [IsAuthenticated, IsTeamAdmin]

    def post(self, request, team_id, user_id, *args, **kwargs):
        try:
            removed_user_id = TeamService.remove_member(
                team_id=team_id,
                user_id=user_id,
                acting_user_id=request.user.id,
            )
        except TeamServiceError as error:
            return Response({'error': str(error)}, status=error.status_code)

        output = TeamUserRemovedOutputSerializer(data={'removed_user_id': removed_user_id})
        output.is_valid(raise_exception=True)
        return Response(output.data, status=status.HTTP_200_OK)
