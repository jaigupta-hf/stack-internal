from teams.utils import get_team_member_name
from users.models import User
from notifications.api import create_notification
from notifications.models import Notification
from notifications.constants import NOTIFICATION_REASON_MENTIONED_IN_QUESTION
from reputation.constants import BOUNTY_AMOUNT
from ..constants import ARTICLE_TYPE_TO_LABEL, BOUNTY_REASON_OPTIONS

from ..models import PostFollow


# Helper to display name.
def _display_name(team_id, user_id):
    return get_team_member_name(team_id, user_id)


# Helper to serialize post mentions.
def _serialize_post_mentions(question):
    mentions = getattr(question, 'mention_notifications', None)
    if mentions is None:
        mentions = (
            Notification.objects.filter(post=question, reason=NOTIFICATION_REASON_MENTIONED_IN_QUESTION)
            .select_related('user', 'triggered_by')
            .order_by('created_at')
        )

    return [
        {
            'id': mention.id,
            'user_id': mention.user_id,
            'user_name': mention.user.name,
            'mentioned_by': mention.triggered_by_id,
            'mentioned_by_name': mention.triggered_by.name,
            'created_at': mention.created_at,
        }
        for mention in mentions
    ]


# Helper to notify question followers.
def _notify_question_followers(*, question, triggered_by, reason):
    follower_ids = list(PostFollow.objects.filter(post=question).values_list('user_id', flat=True))
    if not follower_ids:
        return

    users_by_id = {
        item.id: item
        for item in User.objects.filter(id__in=follower_ids)
    }

    for follower_id in follower_ids:
        target_user = users_by_id.get(follower_id)
        if not target_user:
            continue

        create_notification(
            post=question,
            user=target_user,
            triggered_by=triggered_by,
            reason=reason,
        )


# Helper to serialize bounty.
def _serialize_bounty(bounty):
    if not bounty:
        return None

    return {
        'id': bounty.id,
        'post_id': bounty.post_id,
        'offered_by': bounty.offered_by_id,
        'awarded_answer': bounty.awarded_answer_id,
        'amount': bounty.amount,
        'status': bounty.status,
        'reason': bounty.reason,
        'start_time': bounty.start_time,
        'end_time': bounty.end_time,
    }


# Helper to first serializer error.
def _first_serializer_error(errors):
    if isinstance(errors, dict):
        if not errors:
            return 'Invalid request payload.'
        first_key = next(iter(errors))
        return _first_serializer_error(errors[first_key])

    if isinstance(errors, list):
        if not errors:
            return 'Invalid request payload.'
        return _first_serializer_error(errors[0])

    return str(errors)
