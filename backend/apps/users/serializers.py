from rest_framework import serializers
from .models import User


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'name', 'title', 'about', 'email', 'joined_at', 'last_seen']
        read_only_fields = ['id', 'joined_at', 'last_seen']


class GoogleAuthSerializer(serializers.Serializer):
    token = serializers.CharField(required=True)


class ProfileUpdateSerializer(serializers.Serializer):
    name = serializers.CharField(required=False, max_length=255)
    title = serializers.CharField(required=False, allow_blank=True, max_length=255)
    about = serializers.CharField(required=False, allow_blank=True)

    def validate_name(self, value):
        cleaned = str(value).strip()
        if not cleaned:
            raise serializers.ValidationError('Name cannot be empty')
        return cleaned

    def validate_title(self, value):
        return str(value).strip()

    def validate_about(self, value):
        return str(value).strip()


class ProfileUpdateOutputSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    title = serializers.CharField(allow_blank=True)
    about = serializers.CharField(allow_blank=True)
    last_seen = serializers.DateTimeField()


class ProfileActivityOutputSerializer(serializers.Serializer):
    post_id = serializers.IntegerField()
    type = serializers.IntegerField()
    delete_flag = serializers.BooleanField()
    type_key = serializers.CharField()
    type_label = serializers.CharField()
    title = serializers.CharField()
    created_at = serializers.DateTimeField()
    reference_post_id = serializers.IntegerField()
    reference_type = serializers.CharField()


class ProfileTagUsageOutputSerializer(serializers.Serializer):
    tag_id = serializers.IntegerField()
    tag_name = serializers.CharField()
    count = serializers.IntegerField()
    is_watching = serializers.BooleanField(required=False)
    is_ignored = serializers.BooleanField(required=False)


class ProfileOutputSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    title = serializers.CharField(allow_blank=True)
    about = serializers.CharField(allow_blank=True)
    membership_type = serializers.CharField()
    reputation = serializers.IntegerField()
    team_joined_at = serializers.DateTimeField()
    last_seen = serializers.DateTimeField()
    can_edit = serializers.BooleanField()
    activities = ProfileActivityOutputSerializer(many=True)
    tag_usages = ProfileTagUsageOutputSerializer(many=True)
