from django.db.models import Max

from tags.api import serialize_post_tags, tag_prefetch

from ..constants import POST_TYPE_ANSWER
from ..models import Post, PostActivity, PostVersion


# Normalize targets so answer-related events attach to the parent question timeline.
def resolve_activity_post_and_answer(post):
    if post.type == POST_TYPE_ANSWER and post.parent_id:
        return post.parent, post
    return post, None


# Create a post activity row with optional related references.
def create_post_activity(*, post, action, actor=None, comment=None, answer=None, post_version=None):
    return PostActivity.objects.create(
        post=post,
        comment=comment,
        answer=answer,
        post_version=post_version,
        actor=actor,
        action=action,
    )


def get_post_version_tags_snapshot(post, prefetched_attr=None):
    if prefetched_attr:
        if not hasattr(post, prefetched_attr):
            post = Post.objects.prefetch_related(tag_prefetch(prefetched_attr)).get(id=post.id)
        return serialize_post_tags(post, prefetched_attr)

    return []


def create_post_version(*, post, reason, prefetched_attr=None, tags_snapshot=None):
    if post.type == POST_TYPE_ANSWER:
        return None

    locked_post = Post.objects.select_for_update().get(id=post.id)
    latest_version = (
        PostVersion.objects.filter(post=locked_post).aggregate(max_version=Max('version')).get('max_version')
        or 0
    )
    resolved_tags_snapshot = tags_snapshot
    if resolved_tags_snapshot is None:
        resolved_tags_snapshot = get_post_version_tags_snapshot(locked_post, prefetched_attr=prefetched_attr)

    return PostVersion.objects.create(
        post=locked_post,
        version=latest_version + 1,
        title=locked_post.title,
        body=locked_post.body,
        tags_snapshot=resolved_tags_snapshot,
        reason=reason,
    )
