from django.contrib import admin
from .models import Post, PostActivity, PostVersion

@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ('id', 'team', 'user', 'type', 'title', 'created_at', 'approved_answer')
    list_filter = ('type', 'created_at')
    search_fields = ('title', 'body')
    ordering = ('-created_at',)

@admin.register(PostVersion)
class PostVersionAdmin(admin.ModelAdmin):
    list_display = ('id', 'post', 'title', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('title', 'body')
    ordering = ('-created_at',)


@admin.register(PostActivity)
class PostActivityAdmin(admin.ModelAdmin):
    list_display = ('id', 'post', 'answer', 'comment', 'actor', 'action', 'created_at')
    list_filter = ('action', 'created_at')
    search_fields = ('post__title', 'answer__body', 'comment__body', 'actor__name')
    ordering = ('-created_at',)