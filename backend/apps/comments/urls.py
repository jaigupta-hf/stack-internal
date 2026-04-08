from django.urls import path
from .views import CommentViewSet

comment_create_view = CommentViewSet.as_view({'post': 'create'})
comment_detail_view = CommentViewSet.as_view({'patch': 'partial_update', 'delete': 'destroy'})

urlpatterns = [
    path('', comment_create_view, name='create-comment'),
    path('<int:pk>/', comment_detail_view, name='comment-detail'),
]
