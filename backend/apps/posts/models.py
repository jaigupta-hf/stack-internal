from django.db import models
from teams.models import Team
from users.models import User


class Post(models.Model):
	id = models.BigAutoField(primary_key=True)
	type = models.IntegerField()
	title = models.CharField(max_length=255, blank=True, default='')
	body = models.TextField(blank=True, default='')
	parent = models.ForeignKey(
		'self',
		on_delete=models.SET_NULL,
		null=True,
		blank=True,
		related_name='child_posts',
	)
	created_at = models.DateTimeField(auto_now_add=True)
	modified_at = models.DateTimeField(auto_now=True)
	views_count = models.IntegerField(default=0)
	team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name='posts')
	user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='posts')
	vote_count = models.IntegerField(default=0)
	bookmarks_count = models.IntegerField(default=0)
	approved_answer = models.ForeignKey(
		'self',
		on_delete=models.SET_NULL,
		null=True,
		blank=True,
		related_name='approved_for_posts',
	)
	closed_reason = models.TextField(blank=True, default='')
	closed_at = models.DateTimeField(null=True, blank=True)
	closed_by = models.ForeignKey(
		User,
		on_delete=models.SET_NULL,
		null=True,
		blank=True,
		related_name='closed_posts',
	)
	edited_by = models.ForeignKey(
		User,
		on_delete=models.SET_NULL,
		null=True,
		blank=True,
		related_name='edited_posts',
	)
	answer_count = models.IntegerField(null=True, blank=True, default=None)
	delete_flag = models.BooleanField(default=False)
	bounty_amount = models.IntegerField(default=0)

	class Meta:
		db_table = 'posts'

	def __str__(self):
		return f'Post #{self.id}'


class Bookmark(models.Model):
	id = models.BigAutoField(primary_key=True)
	post = models.ForeignKey(Post, on_delete=models.CASCADE, null=True, blank=True, related_name='bookmarks')
	collection = models.ForeignKey('collections.Collection', on_delete=models.CASCADE, null=True, blank=True, related_name='bookmarks')
	user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='bookmarks')

	class Meta:
		db_table = 'bookmarks'
		constraints = [
			models.UniqueConstraint(fields=['user', 'post'], name='uniq_bookmark_user_post'),
			models.UniqueConstraint(fields=['user', 'collection'], name='uniq_bookmark_user_collection'),
			models.CheckConstraint(
				condition=(
					(models.Q(post__isnull=False) & models.Q(collection__isnull=True))
					| (models.Q(post__isnull=True) & models.Q(collection__isnull=False))
				),
				name='bookmark_target_exactly_one',
			),
		]

	def __str__(self):
		return f'Bookmark #{self.id}'


class PostFollow(models.Model):
	id = models.BigAutoField(primary_key=True)
	post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='follows')
	user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='post_follows')
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		db_table = 'post_follows'
		constraints = [
			models.UniqueConstraint(fields=['post', 'user'], name='uniq_post_follow_user'),
		]

	def __str__(self):
		return f'PostFollow #{self.id}'
