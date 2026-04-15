from .interactions import PostInteractionService
from .posts import PostContentService
from .tracking import create_post_activity, create_post_version, resolve_activity_post_and_answer


class PostService(PostContentService, PostInteractionService):
	"""Backward-compatible facade combining content and interaction services."""

__all__ = [
	'PostService',
	'PostContentService',
	'PostInteractionService',
	'create_post_activity',
	'create_post_version',
	'resolve_activity_post_and_answer',
]
