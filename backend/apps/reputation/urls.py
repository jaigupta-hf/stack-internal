from django.urls import path

from .views import ReputationHistoryListView


urlpatterns = [
    path('history/', ReputationHistoryListView.as_view(), name='list_reputation_history'),
]