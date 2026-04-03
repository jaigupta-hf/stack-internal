from django.contrib import admin
from .models import Collection, PostCollection


@admin.register(Collection)
class CollectionAdmin(admin.ModelAdmin):
    list_display = ('id', 'title', 'team', 'user', 'views_count', 'vote_count', 'created_at', 'modified_at')
    search_fields = ('title', 'description', 'team__name', 'user__name', 'user__email')


@admin.register(PostCollection)
class PostCollectionAdmin(admin.ModelAdmin):
    list_display = ('id', 'collection', 'post', 'sequence_number')
    list_filter = ('collection',)
    search_fields = ('collection__title', 'post__title')


