from django.urls import path
from .views import create_comment, comment_detail

urlpatterns = [
    path('', create_comment, name='create-comment'),
    path('<int:comment_id>/', comment_detail, name='comment-detail'),
]
