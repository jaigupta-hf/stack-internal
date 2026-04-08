from django.urls import path
from .views import CollectionViewSet


collection_create_view = CollectionViewSet.as_view({'post': 'create'})
collection_list_view = CollectionViewSet.as_view({'get': 'list'})
collection_detail_view = CollectionViewSet.as_view({'get': 'retrieve'})
collection_upvote_view = CollectionViewSet.as_view({'post': 'upvote'})
collection_remove_upvote_view = CollectionViewSet.as_view({'post': 'remove_upvote'})
collection_create_comment_view = CollectionViewSet.as_view({'post': 'create_comment'})
collection_search_posts_view = CollectionViewSet.as_view({'get': 'search_posts'})
collection_add_post_view = CollectionViewSet.as_view({'post': 'add_post'})


urlpatterns = [
    path('', collection_create_view, name='create-collection'),
    path('list/', collection_list_view, name='list-collections'),
    path('<int:pk>/', collection_detail_view, name='collection-detail'),
    path('<int:pk>/upvote/', collection_upvote_view, name='upvote-collection'),
    path('<int:pk>/upvote/remove/', collection_remove_upvote_view, name='remove-collection-upvote'),
    path('<int:pk>/comments/', collection_create_comment_view, name='create-collection-comment'),
    path('<int:pk>/search-posts/', collection_search_posts_view, name='search-posts-for-collection'),
    path('<int:pk>/posts/', collection_add_post_view, name='add-post-to-collection'),
]
