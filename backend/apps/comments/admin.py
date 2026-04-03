from django.contrib import admin

from .models import Comment


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
	list_display = (
		'id',
		'post',
		'collection',
		'user',
		'vote_count',
		'created_at',
		'modified_at',
	)
	list_filter = ('created_at', 'modified_at')
	search_fields = ('body', 'user__name', 'user__email')
	ordering = ('-created_at',)
	date_hierarchy = 'created_at'
	list_select_related = ('post', 'collection', 'user')
	readonly_fields = ('created_at', 'modified_at')

