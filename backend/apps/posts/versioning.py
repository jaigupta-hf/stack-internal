from django.db.models import Max

from tags.api import serialize_post_tags, tag_prefetch

from .models import Post, PostVersion


def get_post_version_tags_snapshot(post, prefetched_attr=None):
	if prefetched_attr:
		if not hasattr(post, prefetched_attr):
			post = Post.objects.prefetch_related(tag_prefetch(prefetched_attr)).get(id=post.id)
		return serialize_post_tags(post, prefetched_attr)

	return []


def create_post_version(*, post, reason, prefetched_attr=None, tags_snapshot=None):
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