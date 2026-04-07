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
        indexes = [
            models.Index(fields=['user', 'created_at'], name='ntf_user_created_idx'),
            models.Index(fields=['user', 'is_read'], name='ntf_user_is_read_idx'),
            models.Index(fields=['post', 'reason', 'created_at'], name='ntf_post_reason_created_idx'),
            models.Index(fields=['post', 'user', 'reason'], name='ntf_post_user_reason_idx'),
        ]

    def __str__(self):
        return f'Notification #{self.id} for user {self.user_id}'
