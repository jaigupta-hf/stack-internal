from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from teams.models import TeamUser
from teams.utils import get_team_member_name
from users.models import User
from apps.collections.models import Collection
from posts.models import Post
from posts.models import PostFollow
from notifications.api import create_notification
from .models import Comment


def _notify_question_followers(*, question, triggered_by, reason):
	follower_ids = list(PostFollow.objects.filter(post=question).values_list('user_id', flat=True))
	if not follower_ids:
		return

	users_by_id = {
		item.id: item
		for item in User.objects.filter(id__in=follower_ids)
	}

	for follower_id in follower_ids:
		target_user = users_by_id.get(follower_id)
		if not target_user:
			continue

		create_notification(
			post=question,
			user=target_user,
			triggered_by=triggered_by,
			reason=reason,
		)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_comment(request):
	user = request.user

	parent_comment_id = request.data.get('parent_comment_id')
	post_id = request.data.get('post_id')
	collection_id = request.data.get('collection_id')
	body = str(request.data.get('body', '')).strip()

	if not body:
		return Response({'error': 'body cannot be empty'}, status=status.HTTP_400_BAD_REQUEST)

	parent_comment = None
	is_reply = bool(parent_comment_id)
	post = None
	collection = None
	target_team = None

	if is_reply:
		try:
			parent_comment = Comment.objects.select_related('post__team', 'collection__team').get(id=parent_comment_id)
		except Comment.DoesNotExist:
			return Response({'error': 'Parent comment not found'}, status=status.HTTP_404_NOT_FOUND)

		parent_depth = 0
		cursor = parent_comment
		while cursor and cursor.parent_comment_id:
			parent_depth += 1
			if parent_depth >= 2:
				return Response({'error': 'Replies are allowed up to 2 levels only.'}, status=status.HTTP_400_BAD_REQUEST)
			cursor = cursor.parent_comment

		post = parent_comment.post
		collection = parent_comment.collection
		target_team = post.team if post else collection.team
	else:
		if bool(post_id) == bool(collection_id):
			return Response({'error': 'Exactly one of post_id or collection_id is required'}, status=status.HTTP_400_BAD_REQUEST)

		if post_id:
			try:
				post = Post.objects.select_related('team').get(id=post_id, delete_flag=False)
			except Post.DoesNotExist:
				return Response({'error': 'Post not found'}, status=status.HTTP_404_NOT_FOUND)
			target_team = post.team
		else:
			try:
				collection = Collection.objects.select_related('team').get(id=collection_id)
			except Collection.DoesNotExist:
				return Response({'error': 'Collection not found'}, status=status.HTTP_404_NOT_FOUND)
			target_team = collection.team

	if not TeamUser.objects.filter(team=target_team, user=user).exists():
		return Response({'error': 'You are not a member of this team'}, status=status.HTTP_403_FORBIDDEN)

	comment = Comment.objects.create(
		post=post,
		collection=collection,
		parent_comment=parent_comment,
		body=body,
		user=user,
		vote_count=0,
	)

	if is_reply and parent_comment:
		create_notification(
			post=comment.post,
			user=parent_comment.user,
			triggered_by=user,
			reason='comment_replied',
		)
	elif post and post.type == 0:
		create_notification(
			post=post,
			user=post.user,
			triggered_by=user,
			reason='question_commented',
		)
	elif post and post.type == 1:
		create_notification(
			post=post,
			user=post.user,
			triggered_by=user,
			reason='answer_commented',
		)

	if post and post.type == 0:
		_notify_question_followers(
			question=post,
			triggered_by=user,
			reason='new_comment_on_followed_post',
		)

	return Response(
		{
			'id': comment.id,
			'post_id': comment.post_id,
			'collection_id': comment.collection_id,
			'body': comment.body,
			'created_at': comment.created_at,
			'modified_at': comment.modified_at,
			'user': comment.user_id,
			'user_name': get_team_member_name(target_team.id, comment.user_id),
			'vote_count': comment.vote_count,
			'parent_comment': comment.parent_comment_id,
			'current_user_vote': 0,
		},
		status=status.HTTP_201_CREATED,
	)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def comment_detail(request, comment_id):
	user = request.user

	try:
		comment = Comment.objects.select_related('post__team', 'collection__team', 'user').get(id=comment_id)
	except Comment.DoesNotExist:
		return Response({'error': 'Comment not found'}, status=status.HTTP_404_NOT_FOUND)

	target_team = comment.post.team if comment.post_id else comment.collection.team

	if not TeamUser.objects.filter(team=target_team, user=user).exists():
		return Response({'error': 'You are not a member of this team'}, status=status.HTTP_403_FORBIDDEN)

	if comment.user_id != user.id:
		return Response({'error': 'Only the author can modify this comment'}, status=status.HTTP_403_FORBIDDEN)

	if request.method == 'DELETE':
		comment.delete()
		return Response(status=status.HTTP_204_NO_CONTENT)

	body = str(request.data.get('body', '')).strip()
	if not body:
		return Response({'error': 'body cannot be empty'}, status=status.HTTP_400_BAD_REQUEST)

	comment.body = body
	comment.save(update_fields=['body', 'modified_at'])

	return Response(
		{
			'id': comment.id,
			'post_id': comment.post_id,
			'collection_id': comment.collection_id,
			'body': comment.body,
			'created_at': comment.created_at,
			'modified_at': comment.modified_at,
			'user': comment.user_id,
			'user_name': get_team_member_name(target_team.id, comment.user_id),
			'vote_count': comment.vote_count,
			'parent_comment': comment.parent_comment_id,
		},
		status=status.HTTP_200_OK,
	)
