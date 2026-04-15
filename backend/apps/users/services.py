from django.db import transaction
from django.utils import timezone

from posts.constants import ARTICLE_TYPE_VALUES, POST_TYPE_TO_KEY, POST_TYPE_TO_LABEL
from posts.models import Post
from teams.permissions import get_team_membership

from .models import User


class UserServiceError(Exception):
    def __init__(self, message, status_code):
        super().__init__(message)
        self.status_code = status_code


class UserService:
    @staticmethod
    @transaction.atomic
    def update_profile(*, user, updates):
        for field_name, value in updates.items():
            setattr(user, field_name, value)

        if updates:
            user.last_seen = timezone.now()
            user.save(update_fields=[*updates.keys(), 'last_seen'])

        return user

    @staticmethod
    def build_profile_payload(*, requester, team_id, target_user_id=None):
        target_user = requester
        if target_user_id:
            target_user = User.objects.filter(id=target_user_id).first()
            if target_user is None:
                raise UserServiceError('User not found', 404)

        membership = get_team_membership(team_id=team_id, user=target_user, select_related_team=True)
        if membership is None:
            raise UserServiceError('User is not a member of this team', 404)

        requester.last_seen = timezone.now()
        requester.save(update_fields=['last_seen'])

        posts = (
            Post.objects.filter(team_id=team_id, user=target_user)
            .select_related('parent')
            .order_by('-created_at')[:50]
        )

        activities = []
        for post in posts:
            display_title = post.title.strip()
            reference_post_id = post.id
            reference_type = 'article' if post.type in ARTICLE_TYPE_VALUES else 'question'

            if post.type == 1:
                parent_title = post.parent.title.strip() if post.parent and post.parent.title else ''
                display_title = f'{parent_title or "Untitled question"}'
                if post.parent_id:
                    reference_post_id = post.parent_id
                reference_type = 'question'

            activities.append(
                {
                    'post_id': post.id,
                    'type': post.type,
                    'delete_flag': post.delete_flag,
                    'type_key': POST_TYPE_TO_KEY.get(post.type, 'post'),
                    'type_label': POST_TYPE_TO_LABEL.get(post.type, 'Post'),
                    'title': display_title or 'Untitled post',
                    'created_at': post.created_at,
                    'reference_post_id': reference_post_id,
                    'reference_type': reference_type,
                }
            )

        can_edit = target_user.id == requester.id
        tag_usages = []
        tag_user_rows = (
            target_user.tag_users.select_related('tag')
            .filter(count__gt=0)
            .order_by('-count', 'tag__name')
        )
        for tag_user in tag_user_rows:
            item = {
                'tag_id': tag_user.tag_id,
                'tag_name': tag_user.tag.name,
                'count': tag_user.count,
            }
            if can_edit:
                item['is_watching'] = tag_user.is_watching
                item['is_ignored'] = tag_user.is_ignored
            tag_usages.append(item)

        return {
            'id': target_user.id,
            'name': target_user.name,
            'title': target_user.title,
            'about': target_user.about,
            'membership_type': 'admin' if membership.is_admin else 'member',
            'reputation': membership.reputation,
            'team_joined_at': membership.joined_at,
            'last_seen': target_user.last_seen,
            'can_edit': can_edit,
            'activities': activities,
            'tag_usages': tag_usages,
        }
