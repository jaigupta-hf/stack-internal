from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from teams.permissions import ensure_team_membership
from .constants import MAX_NOTIFICATION_LIST_ITEMS

from .models import Notification
from .serializers import (
    NotificationItemOutputSerializer,
    NotificationListOutputSerializer,
    NotificationMarkAllReadOutputSerializer,
    NotificationReadStateOutputSerializer,
    TeamIdInputSerializer,
)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_notifications(request):
    user = request.user

    raw_team_id = request.query_params.get('team_id')
    if not raw_team_id:
        return Response({'error': 'team_id is required'}, status=status.HTTP_400_BAD_REQUEST)

    team_id_serializer = TeamIdInputSerializer(data={'team_id': raw_team_id})
    if not team_id_serializer.is_valid():
        return Response(team_id_serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    team_id = team_id_serializer.validated_data['team_id']

    membership_error = ensure_team_membership(team_id=team_id, user=user)
    if membership_error:
        return membership_error

    notifications = (
        Notification.objects.filter(user=user, post__team_id=team_id)
        .select_related('post', 'triggered_by')
        .order_by('-created_at')[:MAX_NOTIFICATION_LIST_ITEMS]
    )

    payload = [
        {
            'id': item.id,
            'post_id': item.post_id,
            'user_id': item.user_id,
            'triggered_by_id': item.triggered_by_id,
            'triggered_by_name': item.triggered_by.name or '',
            'reason': item.reason or '',
            'created_at': item.created_at,
            'is_read': item.is_read,
            'post_title': item.post.title or '',
            'post_type': item.post.type,
            'post_delete_flag': item.post.delete_flag,
            'parent_post_id': item.post.parent_id,
        }
        for item in notifications
    ]
    unread_count = sum(1 for item in payload if not item['is_read'])

    payload_serializer = NotificationItemOutputSerializer(data=payload, many=True)
    payload_serializer.is_valid(raise_exception=True)

    output = NotificationListOutputSerializer(
        data={'unread_count': unread_count, 'items': payload_serializer.data}
    )
    output.is_valid(raise_exception=True)
    return Response(output.data, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_notification_read(request, notification_id):
    user = request.user

    try:
        notification = Notification.objects.select_related('post').get(id=notification_id, user=user)
    except Notification.DoesNotExist:
        return Response({'error': 'Notification not found'}, status=status.HTTP_404_NOT_FOUND)

    membership_error = ensure_team_membership(team=notification.post.team, user=user)
    if membership_error:
        return membership_error

    if not notification.is_read:
        notification.is_read = True
        notification.save(update_fields=['is_read'])

    output = NotificationReadStateOutputSerializer(data={'id': notification.id, 'is_read': True})
    output.is_valid(raise_exception=True)
    return Response(output.data, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_notification_unread(request, notification_id):
    user = request.user

    try:
        notification = Notification.objects.select_related('post').get(id=notification_id, user=user)
    except Notification.DoesNotExist:
        return Response({'error': 'Notification not found'}, status=status.HTTP_404_NOT_FOUND)

    membership_error = ensure_team_membership(team=notification.post.team, user=user)
    if membership_error:
        return membership_error

    if notification.is_read:
        notification.is_read = False
        notification.save(update_fields=['is_read'])

    output = NotificationReadStateOutputSerializer(data={'id': notification.id, 'is_read': False})
    output.is_valid(raise_exception=True)
    return Response(output.data, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_all_notifications_read(request):
    user = request.user

    raw_team_id = request.data.get('team_id')
    if not raw_team_id:
        return Response({'error': 'team_id is required'}, status=status.HTTP_400_BAD_REQUEST)

    team_id_serializer = TeamIdInputSerializer(data={'team_id': raw_team_id})
    if not team_id_serializer.is_valid():
        return Response(team_id_serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    team_id = team_id_serializer.validated_data['team_id']

    membership_error = ensure_team_membership(team_id=team_id, user=user)
    if membership_error:
        return membership_error

    updated = Notification.objects.filter(user=user, post__team_id=team_id, is_read=False).update(is_read=True)

    output = NotificationMarkAllReadOutputSerializer(data={'updated_count': updated})
    output.is_valid(raise_exception=True)
    return Response(output.data, status=status.HTTP_200_OK)
