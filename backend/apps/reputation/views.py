from collections import OrderedDict

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from apps.pagination import parse_pagination_params, paginate_queryset

from teams.permissions import ensure_team_membership, get_team_membership

from .models import ReputationHistory
from .serializers import (
    ReputationHistoryItemOutputSerializer,
    ReputationHistoryOutputSerializer,
    ReputationHistoryQuerySerializer,
)


# Return a paginated, day-grouped reputation timeline for a team member after membership checks.
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_reputation_history(request):
    user = request.user

    if not request.query_params.get('team_id'):
        return Response({'error': 'team_id is required'}, status=status.HTTP_400_BAD_REQUEST)

    query_serializer = ReputationHistoryQuerySerializer(data=request.query_params)
    if not query_serializer.is_valid():
        return Response(query_serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    query_data = query_serializer.validated_data
    team_id = query_data['team_id']

    membership_error = ensure_team_membership(team_id=team_id, user=user)
    if membership_error:
        return membership_error

    target_user_id = query_data.get('user_id', user.id)

    if get_team_membership(team_id=team_id, user_id=target_user_id) is None:
        return Response({'error': 'Target user is not a member of this team'}, status=status.HTTP_404_NOT_FOUND)

    page, page_size = parse_pagination_params(request)

    history = (
        ReputationHistory.objects.filter(team_id=team_id, user_id=target_user_id)
        .select_related('post')
        .order_by('-created_at')
    )
    history, pagination = paginate_queryset(history, page=page, page_size=page_size)

    # Group entries by calendar date while preserving newest-first date order.
    grouped = OrderedDict()
    for item in history:
        group_key = item.created_at.date().isoformat()
        grouped.setdefault(group_key, []).append(item)

    groups_output = []
    for date_key, entries in grouped.items():
        groups_output.append(
            {
                'date': date_key,
                'total_points': sum(entry.points for entry in entries),
                'items': entries,
            }
        )

    output = ReputationHistoryOutputSerializer(
        {
            'user_id': target_user_id,
            'groups': groups_output,
            'pagination': pagination,
        }
    )

    return Response(output.data, status=status.HTTP_200_OK)
