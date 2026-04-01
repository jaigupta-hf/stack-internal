from django.urls import path
from . import views

urlpatterns = [
    path('', views.teams_handler, name='teams_handler'),
    path('by-slug/<slug:url_endpoint>/', views.team_by_slug_handler, name='team_by_slug_handler'),
    path('<int:team_id>/users/', views.team_users_handler, name='team_users_handler'),
]
