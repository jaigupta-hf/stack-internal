from teams.utils import get_team_member_name
from users.models import User
from notifications.api import create_notification
from notifications.models import Notification
from reputation.constants import BOUNTY_AMOUNT

from .models import PostFollow


BOUNTY_REASON_OPTIONS = {
    'Authoritative reference needed',
    'Canonical answer required',
    'Current answers are outdated',
    'Draw attention',
    'Improve details',
    'Reward existing answer',
}

ARTICLE_TYPE_TO_LABEL = {
    20: 'Announcement',
    21: 'How-to Guide',
    22: 'Knowledge Article',
    23: 'Policy',
}


def _display_name(team_id, user_id):
    return get_team_member_name(team_id, user_id)


def _serialize_post_mentions(question):
    mentions = getattr(question, 'mention_notifications', None)
    if mentions is None:
        mentions = (
            Notification.objects.filter(post=question, reason='mentioned_in_question')
            .select_related('user', 'triggered_by')
            .order_by('created_at')
        )

    return [
        {
            'id': mention.id,
            'user_id': mention.user_id,
            'user_name': _display_name(question.team_id, mention.user_id),
            'mentioned_by': mention.triggered_by_id,
            'mentioned_by_name': _display_name(question.team_id, mention.triggered_by_id),
            'created_at': mention.created_at,
        }
        for mention in mentions
    ]


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
