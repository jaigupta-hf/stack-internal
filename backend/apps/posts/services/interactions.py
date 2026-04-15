from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from reputation.constants import BOUNTY_AMOUNT
from reputation.models import Bounty
from teams.models import TeamUser

from ..constants import BOUNTY_DURATION_DAYS
from ..domain_events import bounty_awarded, emit_post_event, question_closed, question_deleted
from ..models import Post, PostActivity
from .tracking import create_post_activity


class PostInteractionService:
    @staticmethod
    @transaction.atomic
    def cleanup_expired_bounties(question_ids):
        if not question_ids:
            return set()

        expired_bounty_rows = list(
            Bounty.objects.filter(
                post_id__in=question_ids,
                status=Bounty.STATUS_OFFERED,
                end_time__isnull=False,
                end_time__lte=timezone.now(),
            ).values_list('id', 'post_id')
        )
        if not expired_bounty_rows:
            return set()

        expired_bounty_ids = [bounty_id for bounty_id, _ in expired_bounty_rows]
        expired_question_ids = {question_id for _, question_id in expired_bounty_rows}

        Bounty.objects.filter(id__in=expired_bounty_ids).delete()
        Post.objects.filter(id__in=expired_question_ids).update(bounty_amount=0)
        PostActivity.objects.bulk_create(
            [
                PostActivity(
                    post_id=question_id,
                    action=PostActivity.Action.BOUNTY_ENDED,
                )
                for question_id in sorted(expired_question_ids)
            ]
        )

        return expired_question_ids

    @staticmethod
    @transaction.atomic
    def offer_bounty(*, question, actor, reason):
        start_time = timezone.now()
        end_time = start_time + timedelta(days=BOUNTY_DURATION_DAYS)
        bounty = Bounty.objects.create(
            post=question,
            offered_by=actor,
            awarded_answer=None,
            amount=BOUNTY_AMOUNT,
            status=Bounty.STATUS_OFFERED,
            reason=reason,
            start_time=start_time,
            end_time=end_time,
        )
        Post.objects.filter(id=question.id).update(bounty_amount=BOUNTY_AMOUNT)
        question.refresh_from_db(fields=['bounty_amount'])
        create_post_activity(
            post=question,
            actor=actor,
            action=PostActivity.Action.BOUNTY_STARTED,
        )
        return bounty

    @staticmethod
    @transaction.atomic
    def award_bounty(*, question, actor, answer):
        bounty = (
            Bounty.objects.select_for_update()
            .filter(post=question, status=Bounty.STATUS_OFFERED)
            .order_by('-start_time')
            .first()
        )
        if not bounty:
            raise ValueError('No offered bounty found for this question')

        bounty.status = Bounty.STATUS_EARNED
        bounty.awarded_answer = answer
        bounty.end_time = timezone.now()
        bounty.save(update_fields=['status', 'awarded_answer', 'end_time'])

        Post.objects.filter(id=question.id).update(bounty_amount=0)
        question.refresh_from_db(fields=['bounty_amount'])
        create_post_activity(
            post=question,
            answer=answer,
            actor=actor,
            action=PostActivity.Action.BOUNTY_ENDED,
        )
        emit_post_event(
            bounty_awarded,
            question_id=question.id,
            answer_id=answer.id,
            actor_id=actor.id,
            amount=BOUNTY_AMOUNT,
        )
        return bounty

    @staticmethod
    @transaction.atomic
    def close_question(*, question, actor, reason, duplicate_question=None):
        closed_at = timezone.now()
        Post.objects.filter(id=question.id).update(
            closed_reason=reason,
            closed_by=actor,
            closed_at=closed_at,
            parent=duplicate_question if reason == 'duplicate' else None,
        )
        create_post_activity(
            post=question,
            actor=actor,
            action=PostActivity.Action.POST_CLOSED,
        )
        emit_post_event(question_closed, question_id=question.id, actor_id=actor.id)
        return closed_at

    @staticmethod
    @transaction.atomic
    def reopen_question(*, question, actor):
        Post.objects.filter(id=question.id).update(
            closed_reason='',
            closed_by=None,
            closed_at=None,
            parent=None,
        )
        create_post_activity(
            post=question,
            actor=actor,
            action=PostActivity.Action.POST_REOPENED,
        )

    @staticmethod
    @transaction.atomic
    def mark_question_deleted(*, question, actor):
        if question.delete_flag:
            return False

        Post.objects.filter(id=question.id).update(delete_flag=True)
        create_post_activity(
            post=question,
            actor=actor,
            action=PostActivity.Action.POST_DELETED,
        )
        emit_post_event(question_deleted, question_id=question.id, actor_id=actor.id)
        return True

    @staticmethod
    @transaction.atomic
    def undelete_question(*, question, actor):
        if not question.delete_flag:
            return False

        Post.objects.filter(id=question.id).update(delete_flag=False)
        create_post_activity(
            post=question,
            actor=actor,
            action=PostActivity.Action.POST_UNDELETED,
        )
        return True

    @staticmethod
    def team_reputation_for_question_actor(*, question, actor):
        membership = TeamUser.objects.filter(team=question.team, user=actor).first()
        if membership and membership.reputation and membership.reputation > 0:
            return membership.reputation
        return 1
