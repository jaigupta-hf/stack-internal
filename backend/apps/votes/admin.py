from django.contrib import admin

from .models import Vote


@admin.register(Vote)
class VoteAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'post', 'comment', 'vote', 'timestamp')
    list_filter = ('vote', 'timestamp')
    search_fields = ('user__name', 'user__email')
    ordering = ('-timestamp',)
    list_select_related = ('user', 'post', 'comment')
