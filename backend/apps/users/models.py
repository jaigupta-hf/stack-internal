from django.db import models
from django.utils import timezone


class User(models.Model):
    """
    Model to store app user data.
    """
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=255)
    title = models.CharField(max_length=255, blank=True, default='')
    about = models.TextField(blank=True, default='')
    email = models.EmailField(max_length=255, unique=True, db_column='mail')
    joined_at = models.DateTimeField(default=timezone.now)
    last_seen = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'users'
    
    def __str__(self):
        return self.email

    @property
    def is_authenticated(self):
        return True

    @property
    def is_anonymous(self):
        return False

