from django.urls import path

from .views import submit_vote, remove_vote

urlpatterns = [
    path('', submit_vote, name='submit-vote'),
    path('remove/', remove_vote, name='remove-vote'),
]
