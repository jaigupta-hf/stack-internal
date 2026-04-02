from django.urls import path

from .views import list_reputation_history


urlpatterns = [
    path('history/', list_reputation_history, name='list_reputation_history'),
]