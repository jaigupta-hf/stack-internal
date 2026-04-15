__all__ = [
	'PostService',
	'PostContentService',
	'PostInteractionService',
	'create_post_activity',
	'create_post_version',
	'resolve_activity_post_and_answer',
]


def __getattr__(name):
	if name in {'PostContentService', 'PostInteractionService', 'PostService'}:
		from posts.services.interactions import PostInteractionService
		from posts.services.posts import PostContentService

		class PostService(PostContentService, PostInteractionService):
			"""Backward-compatible facade combining content and interaction services."""

		mapping = {
			'PostContentService': PostContentService,
			'PostInteractionService': PostInteractionService,
			'PostService': PostService,
		}
		return mapping[name]

	if name in {'create_post_activity', 'create_post_version', 'resolve_activity_post_and_answer'}:
		from posts.services.tracking import (
			create_post_activity,
			create_post_version,
			resolve_activity_post_and_answer,
		)

		mapping = {
			'create_post_activity': create_post_activity,
			'create_post_version': create_post_version,
			'resolve_activity_post_and_answer': resolve_activity_post_and_answer,
		}
		return mapping[name]

	raise AttributeError(name)
