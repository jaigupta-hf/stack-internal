from django.dispatch import receiver

from posts.domain_events import answer_approval_changed, bounty_awarded
from posts.models import Post
from users.models import User

from .api import apply_reputation_change
from .constants import (
    ANSWER_ACCEPT_GAIN,
    ANSWER_UNACCEPT_LOSS,
    REPUTATION_REASON_ACCEPT,
    REPUTATION_REASON_BOUNTY_EARNED,
    REPUTATION_REASON_BOUNTY_OFFERED,
    REPUTATION_REASON_UNACCEPT,
)


def _safe_get_user(user_id):
    if not user_id:
        return None
    return User.objects.filter(id=user_id).first()


@receiver(bounty_awarded)
def handle_bounty_awarded(sender, *, question_id, answer_id, actor_id, amount, **kwargs):
    question = Post.objects.select_related('team', 'user').filter(id=question_id).first()
    answer = Post.objects.select_related('user').filter(id=answer_id).first()
    actor = _safe_get_user(actor_id)
    if not question or not answer or not actor:
        return

    apply_reputation_change(
        user=question.user,
        team=question.team,
        triggered_by=actor,
        post=question,
        points=-amount,
        reason=REPUTATION_REASON_BOUNTY_OFFERED,
    )
    apply_reputation_change(
        user=answer.user,
        team=question.team,
        triggered_by=actor,
        post=answer,
        points=amount,
        reason=REPUTATION_REASON_BOUNTY_EARNED,
    )


@receiver(answer_approval_changed)
def handle_answer_approval_changed(
    sender,
    *,
    question_id,
    actor_id,
    previous_approved_answer_id,
    approved_answer_id,
    already_approved,
    **kwargs,
):
    question = Post.objects.select_related('team').filter(id=question_id).first()
    actor = _safe_get_user(actor_id)
    if not question or not actor:
        return

    if previous_approved_answer_id and (approved_answer_id is None or previous_approved_answer_id != approved_answer_id):
        previous_answer = Post.objects.select_related('user').filter(id=previous_approved_answer_id).first()
        if previous_answer and previous_answer.user_id != actor.id:
            apply_reputation_change(
                user=previous_answer.user,
                team=question.team,
                triggered_by=actor,
                post=previous_answer,
                points=ANSWER_UNACCEPT_LOSS,
                reason=REPUTATION_REASON_UNACCEPT,
            )

    if approved_answer_id and not already_approved:
        approved_answer = Post.objects.select_related('user').filter(id=approved_answer_id).first()
        if approved_answer and approved_answer.user_id != actor.id:
            apply_reputation_change(
                user=approved_answer.user,
                team=question.team,
                triggered_by=actor,
                post=approved_answer,
                points=ANSWER_ACCEPT_GAIN,
                reason=REPUTATION_REASON_ACCEPT,
            )
