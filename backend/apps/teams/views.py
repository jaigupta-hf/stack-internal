from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from apps.pagination import parse_pagination_params, paginate_queryset
from .models import Team, TeamUser
from .permissions import ensure_team_membership, ensure_team_admin, get_team_membership
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


# Ensure the acting user is an admin in the target team before role-management actions.
def _get_admin_context_or_response(*, team_id, user):
	team, team_error = _get_team_or_404(team_id)
	if team_error:
		return None, None, team_error

	acting_membership = get_team_membership(team=team, user=user)
	admin_error = ensure_team_admin(membership=acting_membership)
	if admin_error:
		return None, None, admin_error

	return team, acting_membership, None


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


# List the user's joined teams (GET) or create a new team and add the creator as an admin (POST).
@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def teams_handler(request):
	user = request.user

	if request.method == 'GET':
		memberships = (
			TeamUser.objects.filter(user=user)
			.select_related('team')
			.order_by('team__name')
		)
		data = [
			{
				'id': membership.team.id,
				'name': membership.team.name,
				'url_endpoint': membership.team.url_endpoint,
				'is_admin': membership.is_admin,
			}
			for membership in memberships
		]
		output = TeamListItemOutputSerializer(data=data, many=True)
		output.is_valid(raise_exception=True)
		return Response(output.data, status=status.HTTP_200_OK)

	serializer = TeamSerializer(data=request.data)
	if not serializer.is_valid():
		return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

	team = serializer.save()
	TeamUser.objects.create(team=team, user=user, is_admin=True)
	return Response(TeamSerializer(team).data, status=status.HTTP_201_CREATED)


# Look up a team by slug and return membership/admin flags for the current user.
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def team_by_slug_handler(request, url_endpoint):
	user = request.user

	try:
		team = Team.objects.get(url_endpoint=url_endpoint)
	except Team.DoesNotExist:
		return Response({'error': 'Team not found'}, status=status.HTTP_404_NOT_FOUND)

	membership = get_team_membership(team=team, user=user)

	output = TeamBySlugOutputSerializer(
		data={
			'id': team.id,
			'name': team.name,
			'url_endpoint': team.url_endpoint,
			'is_member': membership is not None,
			'is_admin': membership.is_admin if membership else False,
		}
	)
	output.is_valid(raise_exception=True)
	return Response(output.data, status=status.HTTP_200_OK)


# Join a team for the current user, returning whether membership already existed.
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def join_team_handler(request, team_id):
	user = request.user

	try:
		team = Team.objects.get(id=team_id)
	except Team.DoesNotExist:
		return Response({'error': 'Team not found'}, status=status.HTTP_404_NOT_FOUND)

	membership = get_team_membership(team=team, user=user)
	if membership:
		output = TeamJoinOutputSerializer(
			data={
				'id': team.id,
				'name': team.name,
				'url_endpoint': team.url_endpoint,
				'is_member': True,
				'is_admin': membership.is_admin,
				'already_member': True,
			}
		)
		output.is_valid(raise_exception=True)
		return Response(output.data, status=status.HTTP_200_OK)

	TeamUser.objects.create(team=team, user=user, is_admin=False)

	output = TeamJoinOutputSerializer(
		data={
			'id': team.id,
			'name': team.name,
			'url_endpoint': team.url_endpoint,
			'is_member': True,
			'is_admin': False,
			'already_member': False,
		}
	)
	output.is_valid(raise_exception=True)
	return Response(output.data, status=status.HTTP_201_CREATED)


# Return a paginated member list for a team after confirming the requester belongs to it.
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def team_users_handler(request, team_id):
	user = request.user

	try:
		team = Team.objects.get(id=team_id)
	except Team.DoesNotExist:
		return Response({'error': 'Team not found'}, status=status.HTTP_404_NOT_FOUND)

	membership_error = ensure_team_membership(team=team, user=user)
	if membership_error:
		return membership_error

	page, page_size = parse_pagination_params(request)

	members = (
		TeamUser.objects.filter(team=team)
		.select_related('user')
		.order_by('-is_admin', 'user__name')
	)
	members, pagination = paginate_queryset(members, page=page, page_size=page_size)

	data = [
		{
			'id': member.user.id,
			'name': member.user.name,
			'email': member.user.email,
			'is_admin': member.is_admin,
			'joined_at': member.joined_at,
		}
		for member in members
	]

	output = TeamUsersListOutputSerializer(data={'items': data, 'pagination': pagination})
	output.is_valid(raise_exception=True)
	return Response(output.data, status=status.HTTP_200_OK)


# Promote a team member to admin role (admin-only action).
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def make_team_admin_handler(request, team_id, user_id):
	user = request.user

	team, _, context_error = _get_admin_context_or_response(team_id=team_id, user=user)
	if context_error:
		return context_error

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

	output = TeamUserRoleOutputSerializer(
		data={
			'id': target_membership.user_id,
			'name': target_membership.user.name,
			'is_admin': True,
		}
	)
	output.is_valid(raise_exception=True)
	return Response(output.data, status=status.HTTP_200_OK)


# Demote an admin back to member while preserving at least one admin in the team.
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def make_team_member_handler(request, team_id, user_id):
	user = request.user

	team, _, context_error = _get_admin_context_or_response(team_id=team_id, user=user)
	if context_error:
		return context_error

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

	output = TeamUserRoleOutputSerializer(
		data={
			'id': target_membership.user_id,
			'name': target_membership.user.name,
			'is_admin': False,
		}
	)
	output.is_valid(raise_exception=True)
	return Response(output.data, status=status.HTTP_200_OK)


# Remove a member from a team (admin-only), preventing self-removal and last-admin removal.
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def remove_team_user_handler(request, team_id, user_id):
	user = request.user

	team, _, context_error = _get_admin_context_or_response(team_id=team_id, user=user)
	if context_error:
		return context_error

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
