from django.contrib import admin
from .models import Post

@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ('id', 'team', 'user', 'type', 'title', 'created_at', 'approved_answer')
    list_filter = ('type', 'created_at')
    search_fields = ('title', 'body')
    ordering = ('-created_at',)

