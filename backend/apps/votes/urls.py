from django.urls import path

from .views import VoteViewSet

submit_vote_view = VoteViewSet.as_view({'post': 'create'})
remove_vote_view = VoteViewSet.as_view({'post': 'remove_vote'})

urlpatterns = [
    path('', submit_vote_view, name='submit-vote'),
    path('remove/', remove_vote_view, name='remove-vote'),
]
