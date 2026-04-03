from django.db import models

from posts.models import Post
from users.models import User


class Notification(models.Model):
    id = models.BigAutoField(primary_key=True)
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='notifications')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    triggered_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='triggered_notifications')
    reason = models.CharField(max_length=80)
    created_at = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)

    class Meta:
        db_table = 'notifications'
        ordering = ['-created_at']

    def __str__(self):
        return f'Notification #{self.id} for user {self.user_id}'
