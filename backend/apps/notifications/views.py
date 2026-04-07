from rest_framework import status
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .constants import MAX_NOTIFICATION_LIST_ITEMS
from .models import Notification
from .serializers import (
    NotificationListSerializer,
    NotificationMarkAllReadSerializer,
    NotificationReadStateSerializer,
    TeamIdInputSerializer,
)
from teams.permissions import IsTeamMemberForNotification, IsTeamMemberFromRequest


class NotificationListView(GenericAPIView):
    permission_classes = [IsAuthenticated, IsTeamMemberFromRequest]
    serializer_class = TeamIdInputSerializer
    team_id_location = 'query_params'

    def get(self, request):
        input_serializer = self.get_serializer(data=request.query_params)
        input_serializer.is_valid(raise_exception=True)
        team_id = input_serializer.validated_data['team_id']

        notifications = (
            Notification.objects.filter(user=request.user, post__team_id=team_id)
            .select_related('post', 'triggered_by')
            .order_by('-created_at')[:MAX_NOTIFICATION_LIST_ITEMS]
        )

        notifications_list = list(notifications)
        unread_count = sum(1 for item in notifications_list if not item.is_read)

        output = NotificationListSerializer(
            {
                'unread_count': unread_count,
                'items': notifications_list,
            }
        )
        return Response(output.data, status=status.HTTP_200_OK)


class NotificationReadStateView(GenericAPIView):
    permission_classes = [IsAuthenticated, IsTeamMemberForNotification]

    def _get_notification(self, notification_id, user):
        try:
            return Notification.objects.select_related('post').get(id=notification_id, user=user)
        except Notification.DoesNotExist:
            return None

    def _respond(self, notification):
        payload = NotificationReadStateSerializer({'id': notification.id, 'is_read': notification.is_read}).data
        return Response(payload, status=status.HTTP_200_OK)

    def post(self, request, notification_id, mark_as_read):
        notification = self._get_notification(notification_id, request.user)
        if notification is None:
            return Response({'error': 'Notification not found'}, status=status.HTTP_404_NOT_FOUND)

        self.check_object_permissions(request, notification)

        if notification.is_read != mark_as_read:
            notification.is_read = mark_as_read
            notification.save(update_fields=['is_read'])

        return self._respond(notification)


class MarkNotificationReadView(NotificationReadStateView):
    def post(self, request, notification_id):
        return super().post(request, notification_id, mark_as_read=True)


class MarkNotificationUnreadView(NotificationReadStateView):
    def post(self, request, notification_id):
        return super().post(request, notification_id, mark_as_read=False)


class MarkAllNotificationsReadView(GenericAPIView):
    permission_classes = [IsAuthenticated, IsTeamMemberFromRequest]
    serializer_class = TeamIdInputSerializer
    team_id_location = 'data'

    def post(self, request):
        input_serializer = self.get_serializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)
        team_id = input_serializer.validated_data['team_id']

        updated_count = Notification.objects.filter(
            user=request.user,
            post__team_id=team_id,
            is_read=False,
        ).update(is_read=True)

        payload = NotificationMarkAllReadSerializer({'updated_count': updated_count}).data
        return Response(payload, status=status.HTTP_200_OK)
