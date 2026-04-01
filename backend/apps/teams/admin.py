from django.contrib import admin
from .models import Team, TeamUser


@admin.register(Team)
class TeamAdmin(admin.ModelAdmin):
	list_display = ('id', 'name', 'url_endpoint')
	search_fields = ('name', 'url_endpoint')


@admin.register(TeamUser)
class TeamUserAdmin(admin.ModelAdmin):
	list_display = ('team', 'user', 'is_admin', 'joined_at', 'reputation', 'impact')
	list_filter = ('is_admin', 'joined_at')
	search_fields = ('team__name', 'user__email', 'title')
