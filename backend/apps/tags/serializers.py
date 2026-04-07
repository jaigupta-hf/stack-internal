from rest_framework import serializers


class TeamIdQuerySerializer(serializers.Serializer):
    team_id = serializers.IntegerField()


class TagSearchItemOutputSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    question_count = serializers.IntegerField()
    article_count = serializers.IntegerField()
    total_post_count = serializers.IntegerField()
    watch_count = serializers.IntegerField()


class TeamTagOutputSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    about = serializers.CharField(allow_blank=True)
    question_count = serializers.IntegerField()
    article_count = serializers.IntegerField()
    total_post_count = serializers.IntegerField()
    watch_count = serializers.IntegerField()
    created_at = serializers.DateTimeField()


class TagPreferenceOutputSerializer(serializers.Serializer):
    tag_id = serializers.IntegerField()
    tag_name = serializers.CharField()
    count = serializers.IntegerField()
    is_watching = serializers.BooleanField()
    is_ignored = serializers.BooleanField()


class UpdateTagPreferenceInputSerializer(serializers.Serializer):
    team_id = serializers.IntegerField()
    tag_id = serializers.IntegerField()
    field = serializers.ChoiceField(choices=('is_watching', 'is_ignored'))
    value = serializers.BooleanField()
