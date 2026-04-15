from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .viewsets import ArticleViewSet, QuestionViewSet
from .views import (
    create_answer,
    update_answer,
    delete_answer,
    undelete_answer,
    approve_answer,
    search_questions,
    search_global_titles,
    add_bookmark,
    remove_bookmark,
    list_bookmarks,
    list_followed_posts,
    list_post_versions,
    retrieve_post_version,
)

router = DefaultRouter()
router.register(r'questions', QuestionViewSet, basename='question')
router.register(r'articles', ArticleViewSet, basename='article')

question_list_alias = QuestionViewSet.as_view({'get': 'list'})
article_list_alias = ArticleViewSet.as_view({'get': 'list'})
question_follow_alias = QuestionViewSet.as_view({'post': 'follow'})
question_unfollow_alias = QuestionViewSet.as_view({'post': 'unfollow'})
question_mentions_alias = QuestionViewSet.as_view({'post': 'add_mentions'})
question_remove_mention_alias = QuestionViewSet.as_view({'post': 'remove_mention'})
question_offer_bounty_alias = QuestionViewSet.as_view({'post': 'offer_bounty'})
question_award_bounty_alias = QuestionViewSet.as_view({'post': 'award_bounty'})
question_close_alias = QuestionViewSet.as_view({'post': 'close'})
question_reopen_alias = QuestionViewSet.as_view({'post': 'reopen'})
question_delete_alias = QuestionViewSet.as_view({'post': 'mark_deleted'})
question_undelete_alias = QuestionViewSet.as_view({'post': 'undelete'})

urlpatterns = [
    path('questions/<int:question_id>/answers/', create_answer, name='create-answer'),
    path('answers/<int:answer_id>/', update_answer, name='update-answer'),
    path('answers/<int:answer_id>/delete/', delete_answer, name='delete-answer'),
    path('answers/<int:answer_id>/undelete/', undelete_answer, name='undelete-answer'),
    path('questions/<int:question_id>/approve-answer/', approve_answer, name='approve-answer'),
    path('<int:post_id>/versions/', list_post_versions, name='list-post-versions'),
    path('<int:post_id>/versions/<int:version>/', retrieve_post_version, name='retrieve-post-version'),
    path('questions/list/', question_list_alias, name='list-questions'),
    path('questions/search/', search_questions, name='search-questions'),
    path('search/global/', search_global_titles, name='search-global-titles'),
    path('articles/list/', article_list_alias, name='list-articles'),
    path('questions/<int:pk>/follow/', question_follow_alias, name='follow-question'),
    path('questions/<int:pk>/unfollow/', question_unfollow_alias, name='unfollow-question'),
    path('questions/<int:pk>/mentions/', question_mentions_alias, name='add-question-mentions'),
    path('questions/<int:pk>/mentions/remove/', question_remove_mention_alias, name='remove-question-mention'),
    path('questions/<int:pk>/bounty/offer/', question_offer_bounty_alias, name='offer-question-bounty'),
    path('questions/<int:pk>/bounty/award/', question_award_bounty_alias, name='award-question-bounty'),
    path('questions/<int:pk>/close/', question_close_alias, name='close-question'),
    path('questions/<int:pk>/reopen/', question_reopen_alias, name='reopen-question'),
    path('questions/<int:pk>/delete/', question_delete_alias, name='delete-question'),
    path('questions/<int:pk>/undelete/', question_undelete_alias, name='undelete-question'),
    path('bookmarks/', add_bookmark, name='add-bookmark'),
    path('bookmarks/remove/', remove_bookmark, name='remove-bookmark'),
    path('bookmarks/list/', list_bookmarks, name='list-bookmarks'),
    path('follows/list/', list_followed_posts, name='list-followed-posts'),
    path('', include(router.urls)),
]
