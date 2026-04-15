from rest_framework import serializers
from teams.models import Team
from tags.api import serialize_post_tags
from .models import Post, PostVersion
from .constants import ARTICLE_TYPE_TO_LABEL, ARTICLE_TYPE_VALUES, BOUNTY_REASON_OPTIONS, MAX_TAGS_PER_POST, MIN_TAGS_PER_POST


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
        if len(value) < MIN_TAGS_PER_POST:
            raise serializers.ValidationError(f'At least {MIN_TAGS_PER_POST} tag is required.')
        if len(value) > MAX_TAGS_PER_POST:
            raise serializers.ValidationError(f'Maximum {MAX_TAGS_PER_POST} tags are allowed.')
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
    title = serializers.CharField(allow_blank=True)
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
    vote_count = serializers.IntegerField()


class PostDeleteStateOutputSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    delete_flag = serializers.BooleanField()
    is_deleted = serializers.BooleanField()


class PostVersionOutputSerializer(serializers.ModelSerializer):
    post = serializers.IntegerField(source='post_id', read_only=True)
    tags_snapshot = serializers.JSONField()

    class Meta:
        model = PostVersion
        fields = [
            'id',
            'post',
            'version',
            'title',
            'body',
            'tags_snapshot',
            'reason',
            'created_at',
        ]


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
        if len(value) > MAX_TAGS_PER_POST:
            raise serializers.ValidationError(f'Maximum {MAX_TAGS_PER_POST} tags are allowed.')

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
        choices=BOUNTY_REASON_OPTIONS
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
        if len(value) < MIN_TAGS_PER_POST:
            raise serializers.ValidationError(f'At least {MIN_TAGS_PER_POST} tag is required.')
        if len(value) > MAX_TAGS_PER_POST:
            raise serializers.ValidationError(f'Maximum {MAX_TAGS_PER_POST} tags are allowed.')
        return value


class ArticleCreateOutputModelSerializer(serializers.ModelSerializer):
    type_label = serializers.SerializerMethodField()
    parent = serializers.IntegerField(source='parent_id', allow_null=True, read_only=True)
    approved_answer = serializers.IntegerField(source='approved_answer_id', allow_null=True, read_only=True)
    team = serializers.IntegerField(source='team_id', read_only=True)
    user = serializers.IntegerField(source='user_id', read_only=True)
    user_name = serializers.CharField(source='user.name', read_only=True)
    tags = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = [
            'id',
            'type',
            'type_label',
            'title',
            'body',
            'parent',
            'approved_answer',
            'answer_count',
            'team',
            'user',
            'user_name',
            'tags',
            'created_at',
            'modified_at',
        ]

    def get_type_label(self, obj):
        return ARTICLE_TYPE_TO_LABEL.get(obj.type, 'Article')

    def get_tags(self, obj):
        tag_posts = obj.tag_posts.select_related('tag').all()
        return [{'name': item.tag.name} for item in tag_posts]


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


class ArticleListModelSerializer(serializers.ModelSerializer):
    type_label = serializers.SerializerMethodField()
    tags = serializers.SerializerMethodField()
    user_name = serializers.CharField(source='user.name', read_only=True)
    current_user_vote = serializers.SerializerMethodField()
    is_bookmarked = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = [
            'id',
            'type',
            'type_label',
            'title',
            'body',
            'tags',
            'user_name',
            'created_at',
            'views_count',
            'vote_count',
            'bookmarks_count',
            'current_user_vote',
            'is_bookmarked',
        ]

    def get_type_label(self, obj):
        return ARTICLE_TYPE_TO_LABEL.get(obj.type, 'Article')

    def get_tags(self, obj):
        return serialize_post_tags(obj, 'article_tag_posts')

    def get_current_user_vote(self, obj):
        post_vote_map = self.context.get('post_vote_map', {})
        return post_vote_map.get(obj.id, 0)

    def get_is_bookmarked(self, obj):
        bookmarked_post_ids = self.context.get('bookmarked_post_ids', set())
        return obj.id in bookmarked_post_ids


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
        if len(value) < MIN_TAGS_PER_POST:
            raise serializers.ValidationError(f'At least {MIN_TAGS_PER_POST} tag is required.')
        if len(value) > MAX_TAGS_PER_POST:
            raise serializers.ValidationError(f'Maximum {MAX_TAGS_PER_POST} tags are allowed.')

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


class ArticleDetailModelSerializer(serializers.ModelSerializer):
    type_label = serializers.SerializerMethodField()
    tags = serializers.SerializerMethodField()
    user = serializers.IntegerField(source='user_id', read_only=True)
    user_name = serializers.CharField(source='user.name', read_only=True)
    current_user_vote = serializers.SerializerMethodField()
    is_bookmarked = serializers.SerializerMethodField()
    comments = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = [
            'id',
            'type',
            'type_label',
            'title',
            'body',
            'tags',
            'user',
            'user_name',
            'created_at',
            'modified_at',
            'views_count',
            'vote_count',
            'bookmarks_count',
            'current_user_vote',
            'is_bookmarked',
            'comments',
        ]

    def get_type_label(self, obj):
        return ARTICLE_TYPE_TO_LABEL.get(obj.type, 'Article')

    def get_tags(self, obj):
        return serialize_post_tags(obj, 'article_tag_posts')

    def get_current_user_vote(self, obj):
        post_vote_map = self.context.get('post_vote_map', {})
        return post_vote_map.get(obj.id, 0)

    def get_is_bookmarked(self, obj):
        bookmarked_post_ids = self.context.get('bookmarked_post_ids', set())
        return obj.id in bookmarked_post_ids

    def get_comments(self, obj):
        comments = self.context.get('comments', [])
        comment_vote_map = self.context.get('comment_vote_map', {})
        payload = [
            {
                'id': comment.id,
                'body': comment.body,
                'created_at': comment.created_at,
                'modified_at': comment.modified_at,
                'user': comment.user_id,
                'user_name': comment.user.name,
                'vote_count': comment.vote_count,
                'parent_comment': comment.parent_comment_id,
                'current_user_vote': comment_vote_map.get(comment.id, 0),
            }
            for comment in comments
        ]
        output = ArticleCommentOutputSerializer(data=payload, many=True)
        output.is_valid(raise_exception=True)
        return output.data


class QuestionListModelSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(read_only=True)
    user_is_admin = serializers.SerializerMethodField()
    parent = serializers.IntegerField(source='parent_id', allow_null=True, read_only=True)
    tags = serializers.SerializerMethodField()
    answer_count = serializers.SerializerMethodField()
    approved_answer = serializers.IntegerField(source='approved_answer_id', allow_null=True, read_only=True)
    current_user_vote = serializers.SerializerMethodField()
    is_bookmarked = serializers.SerializerMethodField()
    is_closed = serializers.SerializerMethodField()
    closed_by = serializers.IntegerField(source='closed_by_id', allow_null=True, read_only=True)
    closed_by_username = serializers.SerializerMethodField()
    duplicate_post_id = serializers.SerializerMethodField()
    duplicate_post_title = serializers.SerializerMethodField()
    user_name = serializers.CharField(source='user.name', read_only=True)
    latest_activity_at = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = [
            'id',
            'title',
            'body',
            'bounty_amount',
            'user_id',
            'user_is_admin',
            'parent',
            'tags',
            'answer_count',
            'approved_answer',
            'views_count',
            'vote_count',
            'bookmarks_count',
            'current_user_vote',
            'is_bookmarked',
            'is_closed',
            'closed_reason',
            'closed_at',
            'closed_by',
            'closed_by_username',
            'duplicate_post_id',
            'duplicate_post_title',
            'user_name',
            'created_at',
            'latest_activity_at',
        ]

    def get_user_is_admin(self, obj):
        admin_user_ids = self.context.get('admin_user_ids', set())
        return obj.user_id in admin_user_ids

    def get_tags(self, obj):
        return serialize_post_tags(obj, 'question_tag_posts')

    def get_answer_count(self, obj):
        return obj.answer_count or 0

    def get_current_user_vote(self, obj):
        post_vote_map = self.context.get('post_vote_map', {})
        return post_vote_map.get(obj.id, 0)

    def get_is_bookmarked(self, obj):
        bookmarked_post_ids = self.context.get('bookmarked_post_ids', set())
        return obj.id in bookmarked_post_ids

    def get_is_closed(self, obj):
        return bool(obj.closed_reason)

    def get_closed_by_username(self, obj):
        return obj.closed_by.name if obj.closed_by else None

    def get_duplicate_post_id(self, obj):
        return obj.parent_id if obj.closed_reason == 'duplicate' else None

    def get_duplicate_post_title(self, obj):
        if obj.closed_reason == 'duplicate' and obj.parent:
            return obj.parent.title
        return None

    def get_latest_activity_at(self, obj):
        return getattr(obj, 'latest_answer_activity_at', None) or obj.created_at


class QuestionDetailModelSerializer(serializers.ModelSerializer):
    parent = serializers.IntegerField(source='parent_id', allow_null=True, read_only=True)
    team = serializers.IntegerField(source='team_id', read_only=True)
    user = serializers.IntegerField(source='user_id', read_only=True)
    user_name = serializers.SerializerMethodField()
    current_user_vote = serializers.SerializerMethodField()
    approved_answer = serializers.IntegerField(source='approved_answer_id', allow_null=True, read_only=True)
    can_approve_answers = serializers.SerializerMethodField()
    is_following = serializers.SerializerMethodField()
    followers_count = serializers.SerializerMethodField()
    is_bookmarked = serializers.SerializerMethodField()
    is_closed = serializers.SerializerMethodField()
    closed_by = serializers.IntegerField(source='closed_by_id', allow_null=True, read_only=True)
    closed_by_username = serializers.SerializerMethodField()
    duplicate_post_id = serializers.SerializerMethodField()
    duplicate_post_title = serializers.SerializerMethodField()
    tags = serializers.SerializerMethodField()
    mentions = serializers.SerializerMethodField()
    bounty = serializers.SerializerMethodField()
    can_offer_bounty = serializers.SerializerMethodField()
    can_award_bounty = serializers.SerializerMethodField()
    comments = serializers.SerializerMethodField()
    answers = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = [
            'id',
            'title',
            'body',
            'delete_flag',
            'bounty_amount',
            'parent',
            'created_at',
            'modified_at',
            'team',
            'user',
            'user_name',
            'views_count',
            'vote_count',
            'bookmarks_count',
            'current_user_vote',
            'approved_answer',
            'can_approve_answers',
            'is_following',
            'followers_count',
            'is_bookmarked',
            'is_closed',
            'closed_reason',
            'closed_at',
            'closed_by',
            'closed_by_username',
            'duplicate_post_id',
            'duplicate_post_title',
            'tags',
            'mentions',
            'bounty',
            'can_offer_bounty',
            'can_award_bounty',
            'comments',
            'answers',
        ]

    def _display_name_for(self, user_id):
        display_name_by_user_id = self.context.get('display_name_by_user_id', {})
        return display_name_by_user_id.get(user_id, 'deleted user')

    def get_user_name(self, obj):
        return self._display_name_for(obj.user_id)

    def get_current_user_vote(self, obj):
        post_vote_map = self.context.get('post_vote_map', {})
        return post_vote_map.get(obj.id, 0)

    def get_can_approve_answers(self, obj):
        request_user = self.context['request'].user
        return obj.user_id == request_user.id and not obj.delete_flag

    def get_is_following(self, obj):
        return self.context.get('is_following', False)

    def get_followers_count(self, obj):
        context_followers_count = self.context.get('followers_count')
        if context_followers_count is not None:
            return context_followers_count

        return getattr(obj, 'followers_count', 0)

    def get_is_bookmarked(self, obj):
        return self.context.get('is_bookmarked', False)

    def get_is_closed(self, obj):
        return bool(obj.closed_reason)

    def get_closed_by_username(self, obj):
        if not obj.closed_by_id:
            return None
        return self._display_name_for(obj.closed_by_id)

    def get_duplicate_post_id(self, obj):
        return obj.parent_id if obj.closed_reason == 'duplicate' else None

    def get_duplicate_post_title(self, obj):
        if obj.closed_reason == 'duplicate' and obj.parent:
            return obj.parent.title
        return None

    def get_tags(self, obj):
        return serialize_post_tags(obj, 'question_tag_posts')

    def get_mentions(self, obj):
        return self.context.get('mentions_payload', [])

    def get_bounty(self, obj):
        return self.context.get('bounty_payload')

    def get_can_offer_bounty(self, obj):
        request_user = self.context['request'].user
        return (
            obj.user_id == request_user.id
            and not obj.delete_flag
            and not bool(obj.closed_reason)
            and (obj.bounty_amount or 0) == 0
        )

    def get_can_award_bounty(self, obj):
        request_user = self.context['request'].user
        return obj.user_id == request_user.id and (obj.bounty_amount or 0) > 0

    def get_comments(self, obj):
        comments_by_post_id = self.context.get('comments_by_post_id', {})
        return comments_by_post_id.get(obj.id, [])

    def get_answers(self, obj):
        answer_posts = getattr(obj, 'answer_posts', [])
        comments_by_post_id = self.context.get('comments_by_post_id', {})
        post_vote_map = self.context.get('post_vote_map', {})

        return [
            {
                'id': answer.id,
                'body': answer.body,
                'delete_flag': answer.delete_flag,
                'created_at': answer.created_at,
                'modified_at': answer.modified_at,
                'user': answer.user_id,
                'user_name': self._display_name_for(answer.user_id),
                'vote_count': answer.vote_count,
                'current_user_vote': post_vote_map.get(answer.id, 0),
                'comments': comments_by_post_id.get(answer.id, []),
            }
            for answer in answer_posts
        ]
