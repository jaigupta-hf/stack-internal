from django.urls import path
from .views import search_tags, list_team_tags, list_tag_preferences, update_tag_preference

urlpatterns = [
    path('search/', search_tags, name='search-tags'),
    path('list/', list_team_tags, name='list-team-tags'),
    path('preferences/list/', list_tag_preferences, name='list-tag-preferences'),
    path('preferences/', update_tag_preference, name='update-tag-preference'),
]
