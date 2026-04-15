from django.db import transaction
from django.db.models import F
from django.db.models.functions import Coalesce, Greatest

from tags.api import sync_post_tags, sync_user_tags_for_post

from ..constants import POST_TYPE_ANSWER, POST_TYPE_QUESTION
from ..domain_events import answer_created, answer_edited, emit_post_event, post_edited
from ..models import Post, PostActivity
from .tracking import create_post_activity, create_post_version, resolve_activity_post_and_answer


class PostContentService:
    @staticmethod
    @transaction.atomic
    def create_question(*, user, team, title, body, tags):
        question = Post.objects.create(
            type=POST_TYPE_QUESTION,
            title=title,
            body=body,
            parent=None,
            team=team,
            user=user,
            approved_answer=None,
        )
        sync_post_tags(question, tags or [])
        sync_user_tags_for_post(user, question)
        version = create_post_version(
            post=question,
            reason='created',
            prefetched_attr='question_tag_posts',
        )
        create_post_activity(
            post=question,
            actor=user,
            action=PostActivity.Action.POST_CREATED,
            post_version=version,
        )
        return question

    @staticmethod
    @transaction.atomic
    def update_question(*, question, actor, title, body, tags=None):
        question.title = title
        question.body = body
        question.save(update_fields=['title', 'body', 'modified_at'])

        if tags is not None:
            sync_post_tags(question, tags)

        version = create_post_version(
            post=question,
            reason='edited',
            prefetched_attr='question_tag_posts',
        )
        create_post_activity(
            post=question,
            actor=actor,
            action=PostActivity.Action.POST_EDITED,
            post_version=version,
        )
        emit_post_event(post_edited, post_id=question.id, actor_id=actor.id)
        return question

    @staticmethod
    @transaction.atomic
    def create_article(*, user, team, post_type, title, body, tags):
        article = Post.objects.create(
            type=post_type,
            title=title,
            body=body,
            parent=None,
            team=team,
            user=user,
            approved_answer=None,
            answer_count=None,
        )
        sync_post_tags(article, tags or [])
        sync_user_tags_for_post(user, article)
        version = create_post_version(
            post=article,
            reason='created',
            prefetched_attr='article_tag_posts',
        )
        create_post_activity(
            post=article,
            actor=user,
            action=PostActivity.Action.POST_CREATED,
            post_version=version,
        )
        return article

    @staticmethod
    @transaction.atomic
    def update_article(*, article, actor, post_type, title, body, tags):
        article.title = title
        article.body = body
        article.type = post_type
        article.save(update_fields=['title', 'body', 'type', 'modified_at'])
        sync_post_tags(article, tags or [])

        version = create_post_version(
            post=article,
            reason='edited',
            prefetched_attr='article_tag_posts',
        )
        create_post_activity(
            post=article,
            actor=actor,
            action=PostActivity.Action.POST_EDITED,
            post_version=version,
        )
        emit_post_event(post_edited, post_id=article.id, actor_id=actor.id)
        return article

    @staticmethod
    @transaction.atomic
    def create_answer(*, question, actor, body):
        answer = Post.objects.create(
            type=POST_TYPE_ANSWER,
            title='',
            body=body,
            parent=question,
            team=question.team,
            user=actor,
            views_count=0,
            vote_count=0,
            approved_answer=None,
            closed_reason='',
            closed_at=None,
            closed_by=None,
            delete_flag=False,
            bounty_amount=0,
        )
        version = create_post_version(
            post=answer,
            reason='created',
        )
        create_post_activity(
            post=question,
            answer=answer,
            actor=actor,
            action=PostActivity.Action.ANSWERED,
            post_version=version,
        )

        Post.objects.filter(id=question.id).update(answer_count=Coalesce(F('answer_count'), 0) + 1)
        emit_post_event(
            answer_created,
            question_id=question.id,
            answer_id=answer.id,
            actor_id=actor.id,
        )
        return answer

    @staticmethod
    @transaction.atomic
    def update_answer(*, answer, actor, body):
        answer.body = body
        answer.save(update_fields=['body', 'modified_at'])
        version = create_post_version(
            post=answer,
            reason='edited',
        )
        activity_post, activity_answer = resolve_activity_post_and_answer(answer)
        create_post_activity(
            post=activity_post,
            answer=activity_answer,
            actor=actor,
            action=PostActivity.Action.POST_EDITED,
            post_version=version,
        )
        emit_post_event(answer_edited, answer_id=answer.id, actor_id=actor.id)
        return answer

    @staticmethod
    @transaction.atomic
    def delete_answer(*, answer, actor):
        if answer.delete_flag:
            return False

        Post.objects.filter(id=answer.id).update(delete_flag=True)
        if answer.parent_id:
            Post.objects.filter(id=answer.parent_id).update(
                answer_count=Greatest(Coalesce(F('answer_count'), 0) - 1, 0)
            )
            Post.objects.filter(id=answer.parent_id, approved_answer_id=answer.id).update(approved_answer=None)

        activity_post, activity_answer = resolve_activity_post_and_answer(answer)
        create_post_activity(
            post=activity_post,
            answer=activity_answer,
            actor=actor,
            action=PostActivity.Action.POST_DELETED,
        )
        return True

    @staticmethod
    @transaction.atomic
    def undelete_answer(*, answer, actor):
        if not answer.delete_flag:
            return False

        Post.objects.filter(id=answer.id).update(delete_flag=False)
        if answer.parent_id:
            Post.objects.filter(id=answer.parent_id).update(answer_count=Coalesce(F('answer_count'), 0) + 1)

        activity_post, activity_answer = resolve_activity_post_and_answer(answer)
        create_post_activity(
            post=activity_post,
            answer=activity_answer,
            actor=actor,
            action=PostActivity.Action.POST_UNDELETED,
        )
        return True
