from django.db import models
from teams.models import Team
from users.models import User
from posts.models import Post


class Collection(models.Model):
    id = models.BigAutoField(primary_key=True)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name='collections')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='collections')
    created_at = models.DateTimeField(auto_now_add=True)
    modified_at = models.DateTimeField(auto_now=True)
    views_count = models.BigIntegerField(default=0)
    vote_count = models.IntegerField(default=0)
    bookmarks_count = models.IntegerField(default=0)

    class Meta:
        db_table = 'collections'
        indexes = [
            models.Index(fields=['team', '-created_at'], name='idx_coll_team_created'),
        ]

    def __str__(self):
        return self.title


class PostCollection(models.Model):
    id = models.BigAutoField(primary_key=True)
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='post_collections')
    collection = models.ForeignKey(Collection, on_delete=models.CASCADE, related_name='post_collections')
    sequence_number = models.IntegerField()

    class Meta:
        db_table = 'post_collections'
        constraints = [
            models.UniqueConstraint(fields=['post', 'collection'], name='uniq_post_collection_pair'),
            models.UniqueConstraint(fields=['collection', 'sequence_number'], name='uniq_collection_sequence'),
        ]

    def __str__(self):
        return f'Collection {self.collection_id} -> Post {self.post_id} ({self.sequence_number})'


