from rest_framework import serializers


class CreateCommentInputSerializer(serializers.Serializer):
    parent_comment_id = serializers.IntegerField(required=False)
    post_id = serializers.IntegerField(required=False)
    collection_id = serializers.IntegerField(required=False)
    body = serializers.CharField()

    def validate_body(self, value):
        cleaned = str(value).strip()
        if not cleaned:
            raise serializers.ValidationError('body cannot be empty')
        return cleaned


class UpdateCommentInputSerializer(serializers.Serializer):
    body = serializers.CharField()

    def validate_body(self, value):
        cleaned = str(value).strip()
        if not cleaned:
            raise serializers.ValidationError('body cannot be empty')
        return cleaned


class CommentOutputSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    post_id = serializers.IntegerField(allow_null=True)
    collection_id = serializers.IntegerField(allow_null=True)
    body = serializers.CharField()
    created_at = serializers.DateTimeField()
    modified_at = serializers.DateTimeField()
    user = serializers.IntegerField()
    user_name = serializers.CharField()
    vote_count = serializers.IntegerField()
    parent_comment = serializers.IntegerField(allow_null=True)
    current_user_vote = serializers.IntegerField(required=False)
