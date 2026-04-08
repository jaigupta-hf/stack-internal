from django.db import models

from posts.models import Post
from teams.models import Team
from users.models import User


class ReputationHistory(models.Model):
    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reputation_history')
    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name='reputation_history')
    triggered_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reputation_triggered_history')
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='reputation_history')
    points = models.IntegerField()
    reason = models.CharField(max_length=32)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'reputation_history'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['team', 'user', '-created_at'], name='idx_rep_hist_team_user_cr'),
        ]

    def __str__(self):
        return f'ReputationHistory #{self.id}'


class Bounty(models.Model):
    STATUS_OFFERED = 'offered'
    STATUS_EARNED = 'earned'
    STATUS_CHOICES = (
        (STATUS_OFFERED, 'Offered'),
        (STATUS_EARNED, 'Earned'),
    )

    id = models.BigAutoField(primary_key=True)
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='bounties')
    offered_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='offered_bounties')
    awarded_answer = models.ForeignKey(
        Post,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='earned_bounties',
    )
    amount = models.PositiveIntegerField()
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_OFFERED)
    reason = models.CharField(max_length=255, blank=True, default='')
    start_time = models.DateTimeField(auto_now_add=True)
    end_time = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'bounty'
        ordering = ['-start_time']
        indexes = [
            models.Index(fields=['post', '-start_time'], name='bnty_post_start_idx'),
            models.Index(fields=['post', 'status', '-start_time'], name='bnty_post_status_start_idx'),
        ]

    def __str__(self):
        return f'Bounty #{self.id} ({self.status})'
