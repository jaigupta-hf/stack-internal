from django.urls import path
from . import views

urlpatterns = [
    path('auth/google/', views.google_auth, name='google_auth'),
    path('auth/me/', views.get_current_user, name='current_user'),
    path('auth/logout/', views.logout_user, name='logout'),
    path('profile/', views.get_profile, name='profile'),
]
