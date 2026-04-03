from django.db import models
from django.db.models import Q

from comments.models import Comment
from apps.collections.models import Collection
from posts.models import Post
from users.models import User


class Vote(models.Model):
    id = models.BigAutoField(primary_key=True)
    post = models.ForeignKey(Post, on_delete=models.CASCADE, null=True, blank=True, related_name='votes')
    comment = models.ForeignKey(Comment, on_delete=models.CASCADE, null=True, blank=True, related_name='votes')
    collection = models.ForeignKey(Collection, on_delete=models.CASCADE, null=True, blank=True, related_name='votes')
    vote = models.SmallIntegerField()
    timestamp = models.DateTimeField(auto_now_add=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='votes')

    class Meta:
        db_table = 'votes'
        constraints = [
            models.CheckConstraint(
                condition=Q(vote__in=[-1, 1]),
                name='vote_value_must_be_plus_or_minus_one',
            ),
            models.CheckConstraint(
                condition=(
                    (Q(post__isnull=False) & Q(comment__isnull=True) & Q(collection__isnull=True))
                    | (Q(post__isnull=True) & Q(comment__isnull=False) & Q(collection__isnull=True))
                    | (Q(post__isnull=True) & Q(comment__isnull=True) & Q(collection__isnull=False))
                ),
                name='vote_target_exactly_one',
            ),
            models.UniqueConstraint(
                fields=['user', 'post'],
                condition=Q(post__isnull=False, comment__isnull=True, collection__isnull=True),
                name='uniq_vote_user_post',
            ),
            models.UniqueConstraint(
                fields=['user', 'comment'],
                condition=Q(comment__isnull=False, post__isnull=True, collection__isnull=True),
                name='uniq_vote_user_comment',
            ),
            models.UniqueConstraint(
                fields=['user', 'collection'],
                condition=Q(collection__isnull=False, post__isnull=True, comment__isnull=True),
                name='uniq_vote_user_collection',
            ),
        ]

    def __str__(self):
        if self.post_id:
            target = f'post={self.post_id}'
        elif self.comment_id:
            target = f'comment={self.comment_id}'
        else:
            target = f'collection={self.collection_id}'
        return f'Vote #{self.id} ({target}, vote={self.vote})'
