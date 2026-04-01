from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from pagination import parse_pagination_params, paginate_queryset
from .models import Team, TeamUser
from .serializers import TeamSerializer


# List current user's teams, or create a new team and auto-add creator as admin.
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
		return Response(data, status=status.HTTP_200_OK)

	serializer = TeamSerializer(data=request.data)
	if not serializer.is_valid():
		return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

	team = serializer.save()
	TeamUser.objects.create(team=team, user=user, is_admin=True)
	return Response(TeamSerializer(team).data, status=status.HTTP_201_CREATED)


# Return team metadata by slug and membership flags for current user.
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def team_by_slug_handler(request, url_endpoint):
	user = request.user

	try:
		team = Team.objects.get(url_endpoint=url_endpoint)
	except Team.DoesNotExist:
		return Response({'error': 'Team not found'}, status=status.HTTP_404_NOT_FOUND)

	membership = TeamUser.objects.filter(team=team, user=user).first()

	return Response(
		{
			'id': team.id,
			'name': team.name,
			'url_endpoint': team.url_endpoint,
			'is_member': membership is not None,
			'is_admin': membership.is_admin if membership else False,
		},
		status=status.HTTP_200_OK,
	)


# Return paginated members for a team, only if requester is a member.
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def team_users_handler(request, team_id):
	user = request.user

	try:
		team = Team.objects.get(id=team_id)
	except Team.DoesNotExist:
		return Response({'error': 'Team not found'}, status=status.HTTP_404_NOT_FOUND)

	if not TeamUser.objects.filter(team=team, user=user).exists():
		return Response({'error': 'You are not a member of this team'}, status=status.HTTP_403_FORBIDDEN)

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

	return Response({'items': data, 'pagination': pagination}, status=status.HTTP_200_OK)
