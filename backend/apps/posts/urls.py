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
    follow_question,
    unfollow_question,
    add_question_mentions,
    remove_question_mention,
    offer_question_bounty,
    award_question_bounty,
    close_question,
    reopen_question,
    delete_question,
    undelete_question,
    add_bookmark,
    remove_bookmark,
    list_bookmarks,
    list_followed_posts,
)

router = DefaultRouter()
router.register(r'questions', QuestionViewSet, basename='question')
router.register(r'articles', ArticleViewSet, basename='article')

question_list_alias = QuestionViewSet.as_view({'get': 'list'})
article_list_alias = ArticleViewSet.as_view({'get': 'list'})

urlpatterns = [
    path('questions/<int:question_id>/answers/', create_answer, name='create-answer'),
    path('answers/<int:answer_id>/', update_answer, name='update-answer'),
    path('answers/<int:answer_id>/delete/', delete_answer, name='delete-answer'),
    path('answers/<int:answer_id>/undelete/', undelete_answer, name='undelete-answer'),
    path('questions/<int:question_id>/approve-answer/', approve_answer, name='approve-answer'),
    path('questions/list/', question_list_alias, name='list-questions'),
    path('questions/search/', search_questions, name='search-questions'),
    path('search/global/', search_global_titles, name='search-global-titles'),
    path('articles/list/', article_list_alias, name='list-articles'),
    path('questions/<int:question_id>/follow/', follow_question, name='follow-question'),
    path('questions/<int:question_id>/unfollow/', unfollow_question, name='unfollow-question'),
    path('questions/<int:question_id>/mentions/', add_question_mentions, name='add-question-mentions'),
    path('questions/<int:question_id>/mentions/remove/', remove_question_mention, name='remove-question-mention'),
    path('questions/<int:question_id>/bounty/offer/', offer_question_bounty, name='offer-question-bounty'),
    path('questions/<int:question_id>/bounty/award/', award_question_bounty, name='award-question-bounty'),
    path('questions/<int:question_id>/close/', close_question, name='close-question'),
    path('questions/<int:question_id>/reopen/', reopen_question, name='reopen-question'),
    path('questions/<int:question_id>/delete/', delete_question, name='delete-question'),
    path('questions/<int:question_id>/undelete/', undelete_question, name='undelete-question'),
    path('bookmarks/', add_bookmark, name='add-bookmark'),
    path('bookmarks/remove/', remove_bookmark, name='remove-bookmark'),
    path('bookmarks/list/', list_bookmarks, name='list-bookmarks'),
    path('follows/list/', list_followed_posts, name='list-followed-posts'),
    path('', include(router.urls)),
]
