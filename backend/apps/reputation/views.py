from collections import OrderedDict

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from apps.pagination import parse_pagination_params, paginate_queryset

from teams.models import TeamUser

from .models import ReputationHistory


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_reputation_history(request):
    user = request.user

    team_id = request.query_params.get('team_id')
    if not team_id:
        return Response({'error': 'team_id is required'}, status=status.HTTP_400_BAD_REQUEST)

    if not TeamUser.objects.filter(team_id=team_id, user=user).exists():
        return Response({'error': 'You are not a member of this team'}, status=status.HTTP_403_FORBIDDEN)

    target_user_id = request.query_params.get('user_id') or user.id
    try:
        target_user_id = int(target_user_id)
    except (TypeError, ValueError):
        return Response({'error': 'user_id must be a valid integer'}, status=status.HTTP_400_BAD_REQUEST)

    if not TeamUser.objects.filter(team_id=team_id, user_id=target_user_id).exists():
        return Response({'error': 'Target user is not a member of this team'}, status=status.HTTP_404_NOT_FOUND)

    page, page_size = parse_pagination_params(request)

    history = (
        ReputationHistory.objects.filter(team_id=team_id, user_id=target_user_id)
        .select_related('post')
        .order_by('-created_at')
    )
    history, pagination = paginate_queryset(history, page=page, page_size=page_size)

    grouped = OrderedDict()
    for item in history:
        group_key = item.created_at.date().isoformat()
        if group_key not in grouped:
            grouped[group_key] = {
                'date': group_key,
                'total_points': 0,
                'items': [],
            }

        reference_type = 'article' if item.post.type >= 20 else 'question'
        reference_post_id = item.post.parent_id if item.post.type == 1 and item.post.parent_id else item.post_id

        grouped[group_key]['total_points'] += item.points
        grouped[group_key]['items'].append(
            {
                'id': item.id,
                'points': item.points,
                'reason': item.reason,
                'created_at': item.created_at,
                'triggered_by_id': item.triggered_by_id,
                'post_id': item.post_id,
                'post_title': item.post.title,
                'post_type': item.post.type,
                'reference_type': reference_type,
                'reference_post_id': reference_post_id,
            }
        )

    return Response(
        {
            'user_id': target_user_id,
            'groups': list(grouped.values()),
            'pagination': pagination,
        },
        status=status.HTTP_200_OK,
    )
