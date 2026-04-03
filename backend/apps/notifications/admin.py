from django.contrib import admin

from .models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'triggered_by', 'post', 'reason', 'is_read', 'created_at')
    list_filter = ('reason', 'is_read', 'created_at')
    search_fields = ('user__name', 'triggered_by__name', 'post__title')
