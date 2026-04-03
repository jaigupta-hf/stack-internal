from django.db import models
from posts.models import Post
from users.models import User


class Tag(models.Model):
    id = models.BigAutoField(primary_key=True)
    name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    question_count = models.IntegerField(default=0)
    article_count = models.IntegerField(default=0)
    watch_count = models.IntegerField(default=0)
    about = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'tags'
        constraints = [
            models.UniqueConstraint(fields=['name'], name='uniq_tag_name'),
        ]

    def __str__(self):
        return self.name


class TagPost(models.Model):
    id = models.BigAutoField(primary_key=True)
    tag = models.ForeignKey(Tag, on_delete=models.CASCADE, related_name='tag_posts')
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='tag_posts')

    class Meta:
        db_table = 'tag_posts'
        constraints = [
            models.UniqueConstraint(fields=['tag', 'post'], name='uniq_tag_post'),
        ]

    def __str__(self):
        return f'{self.tag_id}:{self.post_id}'


class TagUser(models.Model):
    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='tag_users')
    tag = models.ForeignKey(Tag, on_delete=models.CASCADE, related_name='tag_users')
    count = models.IntegerField(default=1)
    is_watching = models.BooleanField(default=False)
    is_ignored = models.BooleanField(default=False)

    class Meta:
        db_table = 'tag_users'
        constraints = [
            models.UniqueConstraint(fields=['user', 'tag'], name='uniq_tag_user'),
            models.CheckConstraint(
                condition=~(models.Q(is_watching=True) & models.Q(is_ignored=True)),
                name='tag_user_watch_ignore_exclusive',
            ),
        ]

    def __str__(self):
        return f'{self.user_id}:{self.tag_id}'
