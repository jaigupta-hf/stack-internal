from .constants import POST_TYPE_ANSWER
from .models import PostActivity


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
