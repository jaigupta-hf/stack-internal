from django.urls import path

from .views import (
    MarkAllNotificationsReadView,
    MarkNotificationReadView,
    MarkNotificationUnreadView,
    NotificationListView,
)


urlpatterns = [
    path('list/', NotificationListView.as_view(), name='list-notifications'),
    path('<int:notification_id>/read/', MarkNotificationReadView.as_view(), name='mark-notification-read'),
    path('<int:notification_id>/unread/', MarkNotificationUnreadView.as_view(), name='mark-notification-unread'),
    path('read-all/', MarkAllNotificationsReadView.as_view(), name='mark-all-notifications-read'),
]
