from django.contrib import admin

from .models import Bounty, ReputationHistory


@admin.register(ReputationHistory)
class ReputationHistoryAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'team', 'triggered_by', 'post', 'points', 'created_at')
    list_filter = ('team', 'points', 'created_at')
    search_fields = ('user__email', 'triggered_by__email')


@admin.register(Bounty)
class BountyAdmin(admin.ModelAdmin):
    list_display = ('id', 'post', 'offered_by', 'awarded_answer', 'amount', 'status', 'start_time', 'end_time')
    list_filter = ('status', 'start_time', 'end_time')
    search_fields = ('post__title', 'offered_by__email')
