from django.db import models
from apps.collections.models import Collection
from posts.models import Post
from users.models import User


class Comment(models.Model):
    id = models.BigAutoField(primary_key=True)
    post = models.ForeignKey(Post, on_delete=models.CASCADE, null=True, blank=True, related_name='comments')
    collection = models.ForeignKey(Collection, on_delete=models.CASCADE, null=True, blank=True, related_name='comments')
    parent_comment = models.ForeignKey(
        'self',
        on_delete=models.DO_NOTHING,
        null=True,
        blank=True,
        related_name='child_comments',
        db_constraint=False,
    )
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    modified_at = models.DateTimeField(auto_now=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='comments')
    vote_count = models.IntegerField(default=0)

    class Meta:
        db_table = 'comments'
        indexes = [
            models.Index(fields=['post', 'created_at', 'id'], name='cmt_post_created_id_idx'),
            models.Index(fields=['collection', 'created_at', 'id'], name='cmt_coll_created_id_idx'),
            models.Index(fields=['parent_comment'], name='cmt_parent_comment_idx'),
        ]
        constraints = [
            models.CheckConstraint(
                condition=(
                    (models.Q(post__isnull=False) & models.Q(collection__isnull=True))
                    | (models.Q(post__isnull=True) & models.Q(collection__isnull=False))
                ),
                name='comment_target_exactly_one',
            ),
        ]

    def __str__(self):
        return f'Comment #{self.id}'
