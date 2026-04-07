from rest_framework import serializers
from teams.models import Team


ARTICLE_TYPE_VALUES = (20, 21, 22, 23)


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


class CreateQuestionOutputSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    type = serializers.IntegerField()
    title = serializers.CharField()
    body = serializers.CharField()
    parent = serializers.IntegerField(allow_null=True)
    created_at = serializers.DateTimeField()
    modified_at = serializers.DateTimeField()
    team = serializers.IntegerField()
    user = serializers.IntegerField()
    approved_answer = serializers.IntegerField(allow_null=True)


class CreateAnswerSerializer(serializers.Serializer):
    body = serializers.CharField()

    def validate_body(self, value):
        cleaned = str(value).strip()
        if not cleaned:
            raise serializers.ValidationError('body cannot be empty')
        return cleaned


class UpdateAnswerInputSerializer(serializers.Serializer):
    body = serializers.CharField()

    def validate_body(self, value):
        cleaned = str(value).strip()
        if not cleaned:
            raise serializers.ValidationError('body cannot be empty')
        return cleaned


class CreateAnswerOutputSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    type = serializers.IntegerField()
    title = serializers.CharField()
    body = serializers.CharField()
    parent = serializers.IntegerField(allow_null=True)
    created_at = serializers.DateTimeField()
    modified_at = serializers.DateTimeField()
    team = serializers.IntegerField()
    user = serializers.IntegerField()
    user_name = serializers.CharField()
    vote_count = serializers.IntegerField()
    approved_answer = serializers.IntegerField(allow_null=True)
    closed_reason = serializers.CharField(allow_blank=True)
    closed_by = serializers.IntegerField(allow_null=True)
    delete_flag = serializers.BooleanField()
    bounty_amount = serializers.IntegerField()


class UpdateAnswerOutputSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    body = serializers.CharField()
    created_at = serializers.DateTimeField()
    modified_at = serializers.DateTimeField()
    user = serializers.IntegerField()
    user_name = serializers.CharField()
    edited_by = serializers.IntegerField(allow_null=True)
    edited_by_username = serializers.CharField(allow_null=True)
    vote_count = serializers.IntegerField()


class PostDeleteStateOutputSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    delete_flag = serializers.BooleanField()
    is_deleted = serializers.BooleanField()


class ApproveAnswerInputSerializer(serializers.Serializer):
    answer_id = serializers.IntegerField(
        required=False,
        allow_null=True,
        error_messages={'invalid': 'answer_id must be an integer'},
    )


class ApproveAnswerOutputSerializer(serializers.Serializer):
    question_id = serializers.IntegerField()
    approved_answer = serializers.IntegerField(allow_null=True)


class QuestionTagSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField(max_length=50)


class QuestionListItemOutputSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    title = serializers.CharField()
    body = serializers.CharField()
    bounty_amount = serializers.IntegerField()
    user_id = serializers.IntegerField()
    user_is_admin = serializers.BooleanField()
    parent = serializers.IntegerField(allow_null=True)
    tags = QuestionTagSerializer(many=True)
    answer_count = serializers.IntegerField()
    approved_answer = serializers.IntegerField(allow_null=True)
    views_count = serializers.IntegerField()
    vote_count = serializers.IntegerField()
    bookmarks_count = serializers.IntegerField()
    current_user_vote = serializers.IntegerField()
    is_bookmarked = serializers.BooleanField()
    is_closed = serializers.BooleanField()
    closed_reason = serializers.CharField(allow_blank=True)
    closed_at = serializers.DateTimeField(allow_null=True)
    closed_by = serializers.IntegerField(allow_null=True)
    closed_by_username = serializers.CharField(allow_null=True)
    duplicate_post_id = serializers.IntegerField(allow_null=True)
    duplicate_post_title = serializers.CharField(allow_null=True)
    user_name = serializers.CharField()
    created_at = serializers.DateTimeField()
    latest_activity_at = serializers.DateTimeField()


class QuestionPaginationSerializer(serializers.Serializer):
    page = serializers.IntegerField()
    page_size = serializers.IntegerField()
    total_items = serializers.IntegerField()
    total_pages = serializers.IntegerField()
    has_next = serializers.BooleanField()
    has_previous = serializers.BooleanField()


class QuestionListOutputSerializer(serializers.Serializer):
    items = QuestionListItemOutputSerializer(many=True)
    pagination = QuestionPaginationSerializer()


class QuestionSearchItemOutputSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    title = serializers.CharField()
    user_name = serializers.CharField()
    created_at = serializers.DateTimeField()
    delete_flag = serializers.BooleanField()
    is_closed = serializers.BooleanField()
    closed_reason = serializers.CharField(allow_blank=True)


class GlobalTitleSearchItemOutputSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    type = serializers.CharField()
    title = serializers.CharField()
    user_name = serializers.CharField()
    created_at = serializers.DateTimeField()
    delete_flag = serializers.BooleanField(required=False)


class QuestionCloseOutputSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    is_closed = serializers.BooleanField()
    closed_reason = serializers.CharField(allow_blank=True)
    closed_at = serializers.DateTimeField(allow_null=True)
    closed_by = serializers.IntegerField(allow_null=True)
    closed_by_username = serializers.CharField(allow_null=True)
    duplicate_post_id = serializers.IntegerField(allow_null=True)
    duplicate_post_title = serializers.CharField(allow_null=True)


class QuestionUpdateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255)
    body = serializers.CharField()
    tags = serializers.ListField(
        child=serializers.CharField(max_length=50),
        required=False,
    )

    def validate_title(self, value):
        cleaned = str(value).strip()
        if not cleaned:
            raise serializers.ValidationError('title and body cannot be empty')
        return cleaned

    def validate_body(self, value):
        cleaned = str(value).strip()
        if not cleaned:
            raise serializers.ValidationError('title and body cannot be empty')
        return cleaned

    def validate_tags(self, value):
        if len(value) > 5:
            raise serializers.ValidationError('Maximum 5 tags are allowed.')

        cleaned_tags = []
        for item in value:
            cleaned_tags.append(str(item).strip())
        return cleaned_tags


class QuestionCommentOutputSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    body = serializers.CharField()
    created_at = serializers.DateTimeField()
    modified_at = serializers.DateTimeField()
    user = serializers.IntegerField()
    user_name = serializers.CharField()
    vote_count = serializers.IntegerField()
    parent_comment = serializers.IntegerField(allow_null=True)
    current_user_vote = serializers.IntegerField()


class QuestionAnswerOutputSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    body = serializers.CharField()
    delete_flag = serializers.BooleanField()
    created_at = serializers.DateTimeField()
    modified_at = serializers.DateTimeField()
    user = serializers.IntegerField()
    user_name = serializers.CharField()
    edited_by = serializers.IntegerField(allow_null=True)
    edited_by_username = serializers.CharField(allow_null=True)
    vote_count = serializers.IntegerField()
    current_user_vote = serializers.IntegerField()
    comments = QuestionCommentOutputSerializer(many=True)


class QuestionMentionOutputSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    user_id = serializers.IntegerField()
    user_name = serializers.CharField()
    mentioned_by = serializers.IntegerField()
    mentioned_by_name = serializers.CharField()
    created_at = serializers.DateTimeField()


class QuestionBountyOutputSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    post_id = serializers.IntegerField()
    offered_by = serializers.IntegerField()
    awarded_answer = serializers.IntegerField(allow_null=True)
    amount = serializers.IntegerField()
    status = serializers.CharField()
    reason = serializers.CharField()
    start_time = serializers.DateTimeField()
    end_time = serializers.DateTimeField(allow_null=True)


class QuestionDetailOutputSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    title = serializers.CharField()
    body = serializers.CharField()
    delete_flag = serializers.BooleanField()
    bounty_amount = serializers.IntegerField()
    parent = serializers.IntegerField(allow_null=True)
    created_at = serializers.DateTimeField()
    modified_at = serializers.DateTimeField()
    team = serializers.IntegerField()
    user = serializers.IntegerField()
    user_name = serializers.CharField()
    edited_by = serializers.IntegerField(allow_null=True)
    edited_by_username = serializers.CharField(allow_null=True)
    views_count = serializers.IntegerField()
    vote_count = serializers.IntegerField()
    bookmarks_count = serializers.IntegerField()
    current_user_vote = serializers.IntegerField()
    approved_answer = serializers.IntegerField(allow_null=True)
    can_approve_answers = serializers.BooleanField()
    is_following = serializers.BooleanField()
    followers_count = serializers.IntegerField()
    is_bookmarked = serializers.BooleanField()
    is_closed = serializers.BooleanField()
    closed_reason = serializers.CharField(allow_blank=True)
    closed_at = serializers.DateTimeField(allow_null=True)
    closed_by = serializers.IntegerField(allow_null=True)
    closed_by_username = serializers.CharField(allow_null=True)
    duplicate_post_id = serializers.IntegerField(allow_null=True)
    duplicate_post_title = serializers.CharField(allow_null=True)
    tags = QuestionTagSerializer(many=True)
    mentions = QuestionMentionOutputSerializer(many=True)
    bounty = QuestionBountyOutputSerializer(allow_null=True)
    can_offer_bounty = serializers.BooleanField()
    can_award_bounty = serializers.BooleanField()
    comments = QuestionCommentOutputSerializer(many=True)
    answers = QuestionAnswerOutputSerializer(many=True)


class OfferQuestionBountyInputSerializer(serializers.Serializer):
    reason = serializers.ChoiceField(
        choices=(
            'Authoritative reference needed',
            'Canonical answer required',
            'Current answers are outdated',
            'Draw attention',
            'Improve details',
            'Reward existing answer',
        )
    )


class QuestionBountyStateOutputSerializer(serializers.Serializer):
    question_id = serializers.IntegerField()
    bounty_amount = serializers.IntegerField()
    bounty = QuestionBountyOutputSerializer()


class AwardQuestionBountyInputSerializer(serializers.Serializer):
    answer_id = serializers.IntegerField()


class QuestionAwardBountyOutputSerializer(serializers.Serializer):
    question_id = serializers.IntegerField()
    bounty_amount = serializers.IntegerField()
    bounty = QuestionBountyOutputSerializer()
    awarded_answer_id = serializers.IntegerField()


class QuestionFollowStateOutputSerializer(serializers.Serializer):
    question_id = serializers.IntegerField()
    is_following = serializers.BooleanField()
    followers_count = serializers.IntegerField()


class QuestionMentionInputSerializer(serializers.Serializer):
    user_ids = serializers.ListField(
        child=serializers.IntegerField(),
        allow_empty=False,
    )


class RemoveQuestionMentionInputSerializer(serializers.Serializer):
    user_id = serializers.IntegerField()


class QuestionMentionsCreatedOutputSerializer(serializers.Serializer):
    created_count = serializers.IntegerField()
    mentions = QuestionMentionOutputSerializer(many=True)


class QuestionMentionsRemovedOutputSerializer(serializers.Serializer):
    removed_count = serializers.IntegerField()
    mentions = QuestionMentionOutputSerializer(many=True)


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
        if value not in ARTICLE_TYPE_VALUES:
            raise serializers.ValidationError('Invalid article type.')
        return value

    def validate_tags(self, value):
        if len(value) < 1:
            raise serializers.ValidationError('At least 1 tag is required.')
        if len(value) > 5:
            raise serializers.ValidationError('Maximum 5 tags are allowed.')
        return value


class ArticleTagSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField(max_length=50)


class ArticleCommentOutputSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    body = serializers.CharField()
    created_at = serializers.DateTimeField()
    modified_at = serializers.DateTimeField()
    user = serializers.IntegerField()
    user_name = serializers.CharField()
    vote_count = serializers.IntegerField()
    parent_comment = serializers.IntegerField(allow_null=True)
    current_user_vote = serializers.IntegerField()


class ArticleListItemOutputSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    type = serializers.IntegerField()
    type_label = serializers.CharField()
    title = serializers.CharField()
    body = serializers.CharField()
    tags = ArticleTagSerializer(many=True)
    user_name = serializers.CharField()
    created_at = serializers.DateTimeField()
    views_count = serializers.IntegerField()
    vote_count = serializers.IntegerField()
    bookmarks_count = serializers.IntegerField()
    current_user_vote = serializers.IntegerField()
    is_bookmarked = serializers.BooleanField()


class ArticleUpdateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255)
    body = serializers.CharField()
    type = serializers.IntegerField()
    tags = serializers.ListField(
        child=serializers.CharField(max_length=50),
        required=True,
        allow_empty=False,
    )

    def validate_title(self, value):
        cleaned = str(value).strip()
        if not cleaned:
            raise serializers.ValidationError('title and body cannot be empty')
        return cleaned

    def validate_body(self, value):
        cleaned = str(value).strip()
        if not cleaned:
            raise serializers.ValidationError('title and body cannot be empty')
        return cleaned

    def validate_type(self, value):
        if value not in ARTICLE_TYPE_VALUES:
            raise serializers.ValidationError('Invalid article type.')
        return value

    def validate_tags(self, value):
        if len(value) < 1:
            raise serializers.ValidationError('At least 1 tag is required.')
        if len(value) > 5:
            raise serializers.ValidationError('Maximum 5 tags are allowed.')

        cleaned_tags = []
        for item in value:
            cleaned_tag = str(item).strip()
            if not cleaned_tag:
                raise serializers.ValidationError('Tag names cannot be empty.')
            cleaned_tags.append(cleaned_tag)

        return cleaned_tags


class ArticleUpdateOutputSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    type = serializers.IntegerField()
    type_label = serializers.CharField()
    title = serializers.CharField()
    body = serializers.CharField()
    tags = ArticleTagSerializer(many=True)
    user = serializers.IntegerField()
    user_name = serializers.CharField()
    created_at = serializers.DateTimeField()
    modified_at = serializers.DateTimeField()
    views_count = serializers.IntegerField()


class ArticleDetailOutputSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    type = serializers.IntegerField()
    type_label = serializers.CharField()
    title = serializers.CharField()
    body = serializers.CharField()
    tags = ArticleTagSerializer(many=True)
    user = serializers.IntegerField()
    user_name = serializers.CharField()
    created_at = serializers.DateTimeField()
    modified_at = serializers.DateTimeField()
    views_count = serializers.IntegerField()
    vote_count = serializers.IntegerField()
    bookmarks_count = serializers.IntegerField()
    current_user_vote = serializers.IntegerField()
    is_bookmarked = serializers.BooleanField()
    comments = ArticleCommentOutputSerializer(many=True)
