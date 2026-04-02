from django.urls import path

from .views import list_notifications, mark_all_notifications_read, mark_notification_read, mark_notification_unread


urlpatterns = [
    path('list/', list_notifications, name='list-notifications'),
    path('<int:notification_id>/read/', mark_notification_read, name='mark-notification-read'),
    path('<int:notification_id>/unread/', mark_notification_unread, name='mark-notification-unread'),
    path('read-all/', mark_all_notifications_read, name='mark-all-notifications-read'),
]
