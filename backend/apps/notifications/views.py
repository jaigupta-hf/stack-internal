from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from teams.models import TeamUser
from teams.utils import get_team_member_name

from .models import Notification


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_notifications(request):
    user = request.user

    team_id = request.query_params.get('team_id')
    if not team_id:
        return Response({'error': 'team_id is required'}, status=status.HTTP_400_BAD_REQUEST)

    if not TeamUser.objects.filter(team_id=team_id, user=user).exists():
        return Response({'error': 'You are not a member of this team'}, status=status.HTTP_403_FORBIDDEN)

    notifications = (
        Notification.objects.filter(user=user, post__team_id=team_id)
        .select_related('post', 'triggered_by')
        .order_by('-created_at')[:100]
    )

    payload = [
        {
            'id': item.id,
            'post_id': item.post_id,
            'user_id': item.user_id,
            'triggered_by_id': item.triggered_by_id,
            'triggered_by_name': get_team_member_name(item.post.team_id, item.triggered_by_id),
            'reason': item.reason,
            'created_at': item.created_at,
            'is_read': item.is_read,
            'post_title': item.post.title,
            'post_type': item.post.type,
            'post_delete_flag': item.post.delete_flag,
            'parent_post_id': item.post.parent_id,
        }
        for item in notifications
    ]

    unread_count = sum(1 for item in payload if not item['is_read'])

    return Response({'unread_count': unread_count, 'items': payload}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_notification_read(request, notification_id):
    user = request.user

    try:
        notification = Notification.objects.select_related('post').get(id=notification_id, user=user)
    except Notification.DoesNotExist:
        return Response({'error': 'Notification not found'}, status=status.HTTP_404_NOT_FOUND)

    if not TeamUser.objects.filter(team=notification.post.team, user=user).exists():
        return Response({'error': 'You are not a member of this team'}, status=status.HTTP_403_FORBIDDEN)

    if not notification.is_read:
        notification.is_read = True
        notification.save(update_fields=['is_read'])

    return Response({'id': notification.id, 'is_read': True}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_notification_unread(request, notification_id):
    user = request.user

    try:
        notification = Notification.objects.select_related('post').get(id=notification_id, user=user)
    except Notification.DoesNotExist:
        return Response({'error': 'Notification not found'}, status=status.HTTP_404_NOT_FOUND)

    if not TeamUser.objects.filter(team=notification.post.team, user=user).exists():
        return Response({'error': 'You are not a member of this team'}, status=status.HTTP_403_FORBIDDEN)

    if notification.is_read:
        notification.is_read = False
        notification.save(update_fields=['is_read'])

    return Response({'id': notification.id, 'is_read': False}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_all_notifications_read(request):
    user = request.user

    team_id = request.data.get('team_id')
    if not team_id:
        return Response({'error': 'team_id is required'}, status=status.HTTP_400_BAD_REQUEST)

    if not TeamUser.objects.filter(team_id=team_id, user=user).exists():
        return Response({'error': 'You are not a member of this team'}, status=status.HTTP_403_FORBIDDEN)

    updated = Notification.objects.filter(user=user, post__team_id=team_id, is_read=False).update(is_read=True)

    return Response({'updated_count': updated}, status=status.HTTP_200_OK)
