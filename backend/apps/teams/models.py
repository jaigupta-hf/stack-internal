from django.db import models
from users.models import User


class Team(models.Model):
	id = models.BigAutoField(primary_key=True)
	name = models.CharField(max_length=255)
	url_endpoint = models.SlugField(max_length=255, unique=True)

	class Meta:
		db_table = 'teams'

	def __str__(self):
		return self.name


class TeamUser(models.Model):
	team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name='team_users')
	user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='team_users')
	is_admin = models.BooleanField(default=False)
	joined_at = models.DateTimeField(auto_now_add=True)
	reputation = models.IntegerField(default=1)
	title = models.CharField(max_length=255, blank=True, default='')
	about = models.TextField(blank=True, default='')
	impact = models.BigIntegerField(default=0)

	class Meta:
		db_table = 'team_users'
		constraints = [
			models.UniqueConstraint(fields=['team', 'user'], name='uniq_team_user'),
		]

	def __str__(self):
		return f'{self.user.email} in {self.team.name}'
