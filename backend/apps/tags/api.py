from django.db import IntegrityError, transaction
from django.db.models import F, Prefetch
from django.db.models.functions import Coalesce, Greatest

from .models import Tag, TagPost, TagUser


def _count_field_for_post_type(post_type):
    if int(post_type) == 0:
        return 'question_count'
    return 'article_count'


def normalize_tag_names(tag_names):
    normalized_tags = []
    seen = set()

    for raw_tag in tag_names or []:
        clean_tag = ' '.join(str(raw_tag).strip().split())
        if not clean_tag:
            continue

        key = clean_tag.lower()
        if key in seen:
            continue

        seen.add(key)
        normalized_tags.append(key)

    return normalized_tags


def tag_prefetch(to_attr='question_tag_posts'):
    return Prefetch(
        'tag_posts',
        queryset=TagPost.objects.select_related('tag').order_by('id'),
        to_attr=to_attr,
    )


def serialize_post_tags(post, prefetched_attr='question_tag_posts'):
    return [
        {
            'id': tag_post.tag_id,
            'name': tag_post.tag.name,
        }
        for tag_post in getattr(post, prefetched_attr, [])
    ]


@transaction.atomic
def sync_post_tags(post, tag_names):
    normalized_tags = normalize_tag_names(tag_names)
    count_field = _count_field_for_post_type(post.type)

    current_mappings = list(
        TagPost.objects.filter(post=post)
        .select_related('tag')
        .select_for_update()
    )
    current_by_name = {mapping.tag.name: mapping for mapping in current_mappings}
    requested_names = set(normalized_tags)

    for tag_name, mapping in current_by_name.items():
        if tag_name in requested_names:
            continue

        TagPost.objects.filter(id=mapping.id).delete()
        Tag.objects.filter(id=mapping.tag_id).update(**{
            count_field: Greatest(Coalesce(F(count_field), 0) - 1, 0)
        })

    for tag_name in normalized_tags:
        if tag_name in current_by_name:
            continue

        tag = Tag.objects.select_for_update().filter(name=tag_name).first()
        if not tag:
            try:
                tag = Tag.objects.create(name=tag_name, question_count=0, article_count=0)
            except IntegrityError:
                # Another transaction created the same tag concurrently.
                tag = Tag.objects.select_for_update().get(name=tag_name)

        _, created = TagPost.objects.get_or_create(tag=tag, post=post)
        if created:
            Tag.objects.filter(id=tag.id).update(**{count_field: Coalesce(F(count_field), 0) + 1})


def sync_user_tags_for_post(user, post):
    tag_ids = list(TagPost.objects.filter(post=post).values_list('tag_id', flat=True).distinct())
    if not tag_ids:
        return

    existing_tag_ids = set(
        TagUser.objects.filter(user=user, tag_id__in=tag_ids).values_list('tag_id', flat=True)
    )

    new_tag_ids = [tag_id for tag_id in tag_ids if tag_id not in existing_tag_ids]
    repeated_tag_ids = [tag_id for tag_id in tag_ids if tag_id in existing_tag_ids]

    if new_tag_ids:
        TagUser.objects.bulk_create(
            [TagUser(user=user, tag_id=tag_id, count=1) for tag_id in new_tag_ids],
            ignore_conflicts=True,
        )

    if repeated_tag_ids:
        TagUser.objects.filter(user=user, tag_id__in=repeated_tag_ids).update(count=F('count') + 1)

