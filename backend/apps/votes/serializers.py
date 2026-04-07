from rest_framework import serializers


class VoteTargetInputSerializer(serializers.Serializer):
    post_id = serializers.IntegerField(required=False)
    comment_id = serializers.IntegerField(required=False)

    def validate(self, attrs):
        post_id = attrs.get('post_id')
        comment_id = attrs.get('comment_id')
        if bool(post_id) == bool(comment_id):
            raise serializers.ValidationError('Exactly one of post_id or comment_id is required.')
        return attrs


class SubmitVoteInputSerializer(VoteTargetInputSerializer):
    vote = serializers.IntegerField()

    def validate_vote(self, value):
        if value not in (-1, 1):
            raise serializers.ValidationError('vote must be either +1 or -1')
        return value


class VoteOutputSerializer(serializers.Serializer):
    post_id = serializers.IntegerField(allow_null=True)
    comment_id = serializers.IntegerField(allow_null=True)
    vote = serializers.IntegerField()
    vote_count = serializers.IntegerField()
