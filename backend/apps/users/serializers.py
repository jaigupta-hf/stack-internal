from rest_framework import serializers
from .models import User


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'name', 'title', 'about', 'email', 'joined_at', 'last_seen']
        read_only_fields = ['id', 'joined_at', 'last_seen']


class GoogleAuthSerializer(serializers.Serializer):
    token = serializers.CharField(required=True)
