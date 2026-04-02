from django.urls import path
from .views import (
    create_collection,
    list_collections,
    collection_detail,
    upvote_collection,
    remove_collection_upvote,
    create_collection_comment,
    search_posts_for_collection,
    add_post_to_collection,
)


urlpatterns = [
    path('', create_collection, name='create-collection'),
    path('list/', list_collections, name='list-collections'),
    path('<int:collection_id>/', collection_detail, name='collection-detail'),
    path('<int:collection_id>/upvote/', upvote_collection, name='upvote-collection'),
    path('<int:collection_id>/upvote/remove/', remove_collection_upvote, name='remove-collection-upvote'),
    path('<int:collection_id>/comments/', create_collection_comment, name='create-collection-comment'),
    path('<int:collection_id>/search-posts/', search_posts_for_collection, name='search-posts-for-collection'),
    path('<int:collection_id>/posts/', add_post_to_collection, name='add-post-to-collection'),
]
