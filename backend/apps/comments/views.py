from rest_framework import status
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from teams.permissions import ensure_team_membership
from teams.utils import get_team_member_name
from users.models import User
from apps.collections.models import Collection
from posts.models import Post
from posts.models import PostFollow
from notifications.api import create_notification
from notifications.constants import (
	NOTIFICATION_REASON_ANSWER_COMMENTED,
	NOTIFICATION_REASON_COMMENT_REPLIED,
	NOTIFICATION_REASON_NEW_COMMENT_ON_FOLLOWED_POST,
	NOTIFICATION_REASON_QUESTION_COMMENTED,
)
from .models import Comment
from .serializers import CommentOutputSerializer, CreateCommentInputSerializer, UpdateCommentInputSerializer


# Notify followers of a question when a new comment is added, skipping missing users.
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


class CommentViewSet(viewsets.GenericViewSet):
	"""CBV endpoints for creating, updating, and deleting comments."""

	permission_classes = [IsAuthenticated]
	http_method_names = ['post', 'patch', 'delete', 'head', 'options']

	def _get_comment_for_detail_or_response(self, comment_id):
		try:
			comment = Comment.objects.select_related('post__team', 'collection__team', 'user').get(id=comment_id)
			return comment, None
		except Comment.DoesNotExist:
			return None, Response({'error': 'Comment not found'}, status=status.HTTP_404_NOT_FOUND)

	def create(self, request, *args, **kwargs):
		user = request.user

		input_serializer = CreateCommentInputSerializer(data=request.data)
		if not input_serializer.is_valid():
			return Response(input_serializer.errors, status=status.HTTP_400_BAD_REQUEST)

		validated = input_serializer.validated_data
		parent_comment_id = validated.get('parent_comment_id')
		post_id = validated.get('post_id')
		collection_id = validated.get('collection_id')
		body = validated['body']

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

		membership_error = ensure_team_membership(team=target_team, user=user)
		if membership_error:
			return membership_error

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
				reason=NOTIFICATION_REASON_COMMENT_REPLIED,
			)
		elif post and post.type == 0:
			create_notification(
				post=post,
				user=post.user,
				triggered_by=user,
				reason=NOTIFICATION_REASON_QUESTION_COMMENTED,
			)
		elif post and post.type == 1:
			create_notification(
				post=post,
				user=post.user,
				triggered_by=user,
				reason=NOTIFICATION_REASON_ANSWER_COMMENTED,
			)

		if post and post.type == 0:
			_notify_question_followers(
				question=post,
				triggered_by=user,
				reason=NOTIFICATION_REASON_NEW_COMMENT_ON_FOLLOWED_POST,
			)

		output = CommentOutputSerializer(
			data={
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
			}
		)
		output.is_valid(raise_exception=True)
		return Response(output.data, status=status.HTTP_201_CREATED)

	def partial_update(self, request, pk=None, *args, **kwargs):
		user = request.user

		comment, comment_error = self._get_comment_for_detail_or_response(pk)
		if comment_error:
			return comment_error

		target_team = comment.post.team if comment.post_id else comment.collection.team

		membership_error = ensure_team_membership(team=target_team, user=user)
		if membership_error:
			return membership_error

		if comment.user_id != user.id:
			return Response({'error': 'Only the author can modify this comment'}, status=status.HTTP_403_FORBIDDEN)

		input_serializer = UpdateCommentInputSerializer(data=request.data)
		if not input_serializer.is_valid():
			return Response(input_serializer.errors, status=status.HTTP_400_BAD_REQUEST)
		body = input_serializer.validated_data['body']

		comment.body = body
		comment.save(update_fields=['body', 'modified_at'])

		output = CommentOutputSerializer(
			data={
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
			}
		)
		output.is_valid(raise_exception=True)
		return Response(output.data, status=status.HTTP_200_OK)

	def destroy(self, request, pk=None, *args, **kwargs):
		user = request.user

		comment, comment_error = self._get_comment_for_detail_or_response(pk)
		if comment_error:
			return comment_error

		target_team = comment.post.team if comment.post_id else comment.collection.team

		membership_error = ensure_team_membership(team=target_team, user=user)
		if membership_error:
			return membership_error

		if comment.user_id != user.id:
			return Response({'error': 'Only the author can modify this comment'}, status=status.HTTP_403_FORBIDDEN)

		comment.delete()
		return Response(status=status.HTTP_204_NO_CONTENT)
