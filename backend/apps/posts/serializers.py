from rest_framework import serializers
from teams.models import Team


class CreateQuestionSerializer(serializers.Serializer):
    team_id = serializers.PrimaryKeyRelatedField(queryset=Team.objects.all(), source='team')
    title = serializers.CharField(max_length=255)
    body = serializers.CharField()
    tags = serializers.ListField(
        child=serializers.CharField(max_length=50),
        required=True,
        allow_empty=False,
    )

    def validate_tags(self, value):
        if len(value) < 1:
            raise serializers.ValidationError('At least 1 tag is required.')
        if len(value) > 5:
            raise serializers.ValidationError('Maximum 5 tags are allowed.')
        return value


class CreateAnswerSerializer(serializers.Serializer):
    body = serializers.CharField()


class CreateArticleSerializer(serializers.Serializer):
    team_id = serializers.PrimaryKeyRelatedField(queryset=Team.objects.all(), source='team')
    title = serializers.CharField(max_length=255)
    body = serializers.CharField()
    type = serializers.IntegerField()
    tags = serializers.ListField(
        child=serializers.CharField(max_length=50),
        required=True,
        allow_empty=False,
    )

    def validate_type(self, value):
        if value not in (20, 21, 22, 23):
            raise serializers.ValidationError('Invalid article type.')
        return value

    def validate_tags(self, value):
        if len(value) < 1:
            raise serializers.ValidationError('At least 1 tag is required.')
        if len(value) > 5:
            raise serializers.ValidationError('Maximum 5 tags are allowed.')
        return value
