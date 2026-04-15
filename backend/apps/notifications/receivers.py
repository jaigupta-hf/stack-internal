from django.dispatch import receiver

from posts.domain_events import (
    answer_approval_changed,
    answer_created,
    answer_edited,
    post_edited,
    question_closed,
    question_deleted,
)
from posts.models import Post, PostFollow
from users.models import User

from .api import create_notification
from .constants import (
    NOTIFICATION_REASON_ANSWER_EDITED,
    NOTIFICATION_REASON_ANSWER_POSTED_ON_YOUR_QUESTION,
    NOTIFICATION_REASON_APPROVED_ANSWER_ON_FOLLOWED_POST,
    NOTIFICATION_REASON_NEW_ANSWER_ON_FOLLOWED_POST,
    NOTIFICATION_REASON_QUESTION_CLOSED,
    NOTIFICATION_REASON_QUESTION_DELETED,
    NOTIFICATION_REASON_QUESTION_EDITED,
    NOTIFICATION_REASON_YOUR_ANSWER_WAS_APPROVED,
)


def _safe_get_user(user_id):
    if not user_id:
        return None
    return User.objects.filter(id=user_id).first()


def _notify_followers(*, question, triggered_by, reason):
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


@receiver(post_edited)
def handle_post_edited(sender, *, post_id, actor_id, **kwargs):
    post = Post.objects.select_related('user').filter(id=post_id).first()
    actor = _safe_get_user(actor_id)
    if not post or not actor:
        return

    create_notification(
        post=post,
        user=post.user,
        triggered_by=actor,
        reason=NOTIFICATION_REASON_QUESTION_EDITED,
    )


@receiver(answer_created)
def handle_answer_created(sender, *, question_id, answer_id, actor_id, **kwargs):
    question = Post.objects.select_related('user').filter(id=question_id).first()
    answer = Post.objects.filter(id=answer_id).first()
    actor = _safe_get_user(actor_id)
    if not question or not answer or not actor:
        return

    create_notification(
        post=question,
        user=question.user,
        triggered_by=actor,
        reason=NOTIFICATION_REASON_ANSWER_POSTED_ON_YOUR_QUESTION,
    )
    _notify_followers(
        question=question,
        triggered_by=actor,
        reason=NOTIFICATION_REASON_NEW_ANSWER_ON_FOLLOWED_POST,
    )


@receiver(answer_edited)
def handle_answer_edited(sender, *, answer_id, actor_id, **kwargs):
    answer = Post.objects.select_related('user').filter(id=answer_id).first()
    actor = _safe_get_user(actor_id)
    if not answer or not actor:
        return

    create_notification(
        post=answer,
        user=answer.user,
        triggered_by=actor,
        reason=NOTIFICATION_REASON_ANSWER_EDITED,
    )


@receiver(question_closed)
def handle_question_closed(sender, *, question_id, actor_id, **kwargs):
    question = Post.objects.select_related('user').filter(id=question_id).first()
    actor = _safe_get_user(actor_id)
    if not question or not actor:
        return

    create_notification(
        post=question,
        user=question.user,
        triggered_by=actor,
        reason=NOTIFICATION_REASON_QUESTION_CLOSED,
    )


@receiver(question_deleted)
def handle_question_deleted(sender, *, question_id, actor_id, **kwargs):
    question = Post.objects.select_related('user').filter(id=question_id).first()
    actor = _safe_get_user(actor_id)
    if not question or not actor:
        return

    create_notification(
        post=question,
        user=question.user,
        triggered_by=actor,
        reason=NOTIFICATION_REASON_QUESTION_DELETED,
    )


@receiver(answer_approval_changed)
def handle_answer_approval_changed(sender, *, question_id, approved_answer_id, actor_id, **kwargs):
    if approved_answer_id is None:
        return

    question = Post.objects.select_related('user').filter(id=question_id).first()
    answer = Post.objects.select_related('user').filter(id=approved_answer_id).first()
    actor = _safe_get_user(actor_id)
    if not question or not answer or not actor:
        return

    create_notification(
        post=answer,
        user=answer.user,
        triggered_by=actor,
        reason=NOTIFICATION_REASON_YOUR_ANSWER_WAS_APPROVED,
    )
    _notify_followers(
        question=question,
        triggered_by=actor,
        reason=NOTIFICATION_REASON_APPROVED_ANSWER_ON_FOLLOWED_POST,
    )
