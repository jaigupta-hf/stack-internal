from django.urls import path
from .views import CurrentUserView, GoogleAuthView, LogoutView, ProfileView

urlpatterns = [
    path('auth/google/', GoogleAuthView.as_view(), name='google_auth'),
    path('auth/me/', CurrentUserView.as_view(), name='current_user'),
    path('auth/logout/', LogoutView.as_view(), name='logout'),
    path('profile/', ProfileView.as_view(), name='profile'),
]
