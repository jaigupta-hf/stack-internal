from django.urls import path
from .views import (
    TeamBySlugView,
    TeamJoinView,
    TeamsListCreateView,
    TeamUserMakeAdminView,
    TeamUserMakeMemberView,
    TeamUserRemoveView,
    TeamUsersView,
)

urlpatterns = [
    path('', TeamsListCreateView.as_view(), name='teams_handler'),
    path('by-slug/<slug:url_endpoint>/', TeamBySlugView.as_view(), name='team_by_slug_handler'),
    path('<int:team_id>/users/', TeamUsersView.as_view(), name='team_users_handler'),
    path('<int:team_id>/join/', TeamJoinView.as_view(), name='join_team_handler'),
    path('<int:team_id>/users/<int:user_id>/make-admin/', TeamUserMakeAdminView.as_view(), name='make_team_admin_handler'),
    path('<int:team_id>/users/<int:user_id>/make-member/', TeamUserMakeMemberView.as_view(), name='make_team_member_handler'),
    path('<int:team_id>/users/<int:user_id>/remove/', TeamUserRemoveView.as_view(), name='remove_team_user_handler'),
]
