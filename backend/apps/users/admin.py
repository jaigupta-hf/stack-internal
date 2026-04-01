from django.contrib import admin
from .models import User


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('email', 'name', 'joined_at', 'last_seen')
    list_filter = ('joined_at',)
    search_fields = ('email', 'name')
    ordering = ('-joined_at',)
    readonly_fields = ('joined_at', 'last_seen')
