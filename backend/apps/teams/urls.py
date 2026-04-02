from django.urls import path
from . import views

urlpatterns = [
    path('', views.teams_handler, name='teams_handler'),
    path('by-slug/<slug:url_endpoint>/', views.team_by_slug_handler, name='team_by_slug_handler'),
    path('<int:team_id>/users/', views.team_users_handler, name='team_users_handler'),
    path('<int:team_id>/join/', views.join_team_handler, name='join_team_handler'),
    path('<int:team_id>/users/<int:user_id>/make-admin/', views.make_team_admin_handler, name='make_team_admin_handler'),
    path('<int:team_id>/users/<int:user_id>/make-member/', views.make_team_member_handler, name='make_team_member_handler'),
    path('<int:team_id>/users/<int:user_id>/remove/', views.remove_team_user_handler, name='remove_team_user_handler'),
]
