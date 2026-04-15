from collections import OrderedDict

from rest_framework import status
from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.pagination import CustomPagination
from teams.permissions import IsTeamMember, get_team_membership

from .models import ReputationHistory
from .serializers import ReputationHistoryOutputSerializer, ReputationHistoryQuerySerializer


class ReputationHistoryListView(ListAPIView):
    """Return a paginated, day-grouped reputation timeline for a team member."""

    permission_classes = [IsAuthenticated, IsTeamMember]
    serializer_class = ReputationHistoryQuerySerializer

    def get_team_id_for_permission(self, request):
        return request.query_params.get('team_id')

    def get(self, request, *args, **kwargs):
        if not request.query_params.get('team_id'):
            return Response({'error': 'team_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        query_serializer = self.get_serializer(data=request.query_params)
        if not query_serializer.is_valid():
            return Response(query_serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        query_data = query_serializer.validated_data
        team_id = query_data['team_id']
        target_user_id = query_data.get('user_id', request.user.id)

        if get_team_membership(team_id=team_id, user_id=target_user_id) is None:
            return Response({'error': 'Target user is not a member of this team'}, status=status.HTTP_404_NOT_FOUND)

        history = (
            ReputationHistory.objects.filter(team_id=team_id, user_id=target_user_id)
            .select_related('post', 'post__parent', 'triggered_by')
            .only(
                'id',
                'points',
                'reason',
                'created_at',
                'triggered_by_id',
                'post_id',
                'post__title',
                'post__type',
                'post__parent_id',
            )
            .order_by('-created_at')
        )

        paginator = CustomPagination()
        history = paginator.paginate_queryset(history, request, view=self)
        pagination = paginator.get_pagination_data()

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
