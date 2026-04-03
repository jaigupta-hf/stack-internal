from django.contrib import admin
from .models import Tag, TagPost, TagUser


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
	list_display = ('id', 'name', 'question_count', 'article_count', 'watch_count', 'created_at')
	search_fields = ('name',)
	ordering = ('-created_at',)


@admin.register(TagPost)
class TagPostAdmin(admin.ModelAdmin):
	list_display = ('id', 'tag', 'post')
	search_fields = ('tag__name', 'post__title')

@admin.register(TagUser)
class TagUserAdmin(admin.ModelAdmin):
	list_display = ('id', 'user', 'tag', 'count', 'is_watching', 'is_ignored')
	search_fields = ('user__email', 'tag__name')
	list_filter = ('is_watching', 'is_ignored')
