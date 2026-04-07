from django.db.models import F
from django.db.models.functions import Coalesce, Greatest
from django.db import transaction
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from teams.permissions import ensure_team_membership
from .models import Post
from .serializers import (
	ApproveAnswerInputSerializer,
	ApproveAnswerOutputSerializer,
	CreateAnswerOutputSerializer,
	CreateAnswerSerializer,
	CreateQuestionOutputSerializer,
	CreateQuestionSerializer,
	PostDeleteStateOutputSerializer,
	UpdateAnswerInputSerializer,
	UpdateAnswerOutputSerializer,
)
from tags.api import sync_post_tags, sync_user_tags_for_post
from notifications.api import create_notification
from notifications.constants import (
	NOTIFICATION_REASON_ANSWER_EDITED,
	NOTIFICATION_REASON_ANSWER_POSTED_ON_YOUR_QUESTION,
	NOTIFICATION_REASON_APPROVED_ANSWER_ON_FOLLOWED_POST,
	NOTIFICATION_REASON_NEW_ANSWER_ON_FOLLOWED_POST,
	NOTIFICATION_REASON_YOUR_ANSWER_WAS_APPROVED,
)
from reputation.api import apply_reputation_change
from reputation.constants import (
	ANSWER_ACCEPT_GAIN,
	ANSWER_UNACCEPT_LOSS,
	REPUTATION_REASON_ACCEPT,
	REPUTATION_REASON_UNACCEPT,
)
from .views_common import (
	_first_serializer_error,
	_notify_question_followers,
)
from .views_articles import create_article, list_articles, article_detail
from .views_interactions import (
	add_question_mentions,
	award_question_bounty,
	follow_question,
	offer_question_bounty,
	remove_question_mention,
	unfollow_question,
)
from .views_questions import (
	close_question,
	delete_question,
	list_questions,
	question_detail,
	reopen_question,
	search_global_titles,
	search_questions,
	undelete_question,
)
from .views_bookmarks import (
	add_bookmark,
	list_bookmarks,
	list_followed_posts,
	remove_bookmark,
)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_question(request):
	user = request.user

	serializer = CreateQuestionSerializer(data=request.data)
	if not serializer.is_valid():
		return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

	team = serializer.validated_data['team']
	title = serializer.validated_data['title']
	body = serializer.validated_data['body']
	tag_names = serializer.validated_data.get('tags', [])

	membership_error = ensure_team_membership(team=team, user=user)
	if membership_error:
		return membership_error

	with transaction.atomic():
		post = Post.objects.create(
			type=0,
			title=title,
			body=body,
			parent=None,
			team=team,
			user=user,
			approved_answer=None,
		)

		sync_post_tags(post, tag_names)
		sync_user_tags_for_post(user, post)

	output = CreateQuestionOutputSerializer(
		data={
			'id': post.id,
			'type': post.type,
			'title': post.title,
			'body': post.body,
			'parent': post.parent_id,
			'created_at': post.created_at,
			'modified_at': post.modified_at,
			'team': post.team_id,
			'user': post.user_id,
			'approved_answer': post.approved_answer_id,
		}
	)
	output.is_valid(raise_exception=True)
	return Response(output.data, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_answer(request, question_id):
	user = request.user

	try:
		question = Post.objects.get(id=question_id, type=0)
	except Post.DoesNotExist:
		return Response({'error': 'Question not found'}, status=status.HTTP_404_NOT_FOUND)

	if question.delete_flag:
		return Response({'error': 'This question is deleted and not accepting new answers.'}, status=status.HTTP_400_BAD_REQUEST)

	membership_error = ensure_team_membership(team=question.team, user=user)
	if membership_error:
		return membership_error

	if question.closed_reason:
		return Response({'error': 'This question is closed and not accepting new answers.'}, status=status.HTTP_400_BAD_REQUEST)

	serializer = CreateAnswerSerializer(data=request.data)
	if not serializer.is_valid():
		return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

	body = serializer.validated_data['body']

	answer = Post.objects.create(
		type=1,
		title='',
		body=body,
		parent=question,
		team=question.team,
		user=user,
		views_count=0,
		vote_count=0,
		approved_answer=None,
		closed_reason='',
		closed_at=None,
		closed_by=None,
		delete_flag=False,
		bounty_amount=0,
	)

	Post.objects.filter(id=question.id).update(answer_count=Coalesce(F('answer_count'), 0) + 1)
	create_notification(
		post=question,
		user=question.user,
		triggered_by=user,
		reason=NOTIFICATION_REASON_ANSWER_POSTED_ON_YOUR_QUESTION,
	)
	_notify_question_followers(
		question=question,
		triggered_by=user,
		reason=NOTIFICATION_REASON_NEW_ANSWER_ON_FOLLOWED_POST,
	)

	output = CreateAnswerOutputSerializer(
		data={
			'id': answer.id,
			'type': answer.type,
			'title': answer.title,
			'body': answer.body,
			'parent': answer.parent_id,
			'created_at': answer.created_at,
			'modified_at': answer.modified_at,
			'team': answer.team_id,
			'user': answer.user_id,
			'user_name': user.name,
			'vote_count': answer.vote_count,
			'approved_answer': answer.approved_answer_id,
			'closed_reason': answer.closed_reason,
			'closed_by': answer.closed_by_id,
			'delete_flag': answer.delete_flag,
			'bounty_amount': answer.bounty_amount,
		}
	)
	output.is_valid(raise_exception=True)
	return Response(output.data, status=status.HTTP_201_CREATED)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def update_answer(request, answer_id):
	user = request.user

	try:
		answer = Post.objects.select_related('user', 'edited_by').get(id=answer_id, type=1, delete_flag=False)
	except Post.DoesNotExist:
		return Response({'error': 'Answer not found'}, status=status.HTTP_404_NOT_FOUND)

	membership_error = ensure_team_membership(team=answer.team, user=user)
	if membership_error:
		return membership_error

	update_serializer = UpdateAnswerInputSerializer(data=request.data)
	if not update_serializer.is_valid():
		return Response(update_serializer.errors, status=status.HTTP_400_BAD_REQUEST)
	body = update_serializer.validated_data['body']

	answer.body = body
	answer.edited_by = user
	answer.save()
	create_notification(
		post=answer,
		user=answer.user,
		triggered_by=user,
		reason=NOTIFICATION_REASON_ANSWER_EDITED,
	)

	output = UpdateAnswerOutputSerializer(
		data={
			'id': answer.id,
			'body': answer.body,
			'created_at': answer.created_at,
			'modified_at': answer.modified_at,
			'user': answer.user_id,
			'user_name': answer.user.name,
			'edited_by': answer.edited_by_id,
			'edited_by_username': answer.edited_by.name if answer.edited_by else None,
			'vote_count': answer.vote_count,
		}
	)
	output.is_valid(raise_exception=True)
	return Response(output.data, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def delete_answer(request, answer_id):
	user = request.user

	try:
		answer = Post.objects.select_related('team', 'parent').get(id=answer_id, type=1)
	except Post.DoesNotExist:
		return Response({'error': 'Answer not found'}, status=status.HTTP_404_NOT_FOUND)

	membership_error = ensure_team_membership(team=answer.team, user=user)
	if membership_error:
		return membership_error

	if answer.user_id != user.id:
		return Response({'error': 'Only the answer author can delete this answer'}, status=status.HTTP_403_FORBIDDEN)

	if not answer.delete_flag:
		Post.objects.filter(id=answer.id).update(delete_flag=True)
		if answer.parent_id:
			Post.objects.filter(id=answer.parent_id).update(
				answer_count=Greatest(Coalesce(F('answer_count'), 0) - 1, 0)
			)
			Post.objects.filter(id=answer.parent_id, approved_answer_id=answer.id).update(approved_answer=None)

	output = PostDeleteStateOutputSerializer(
		data={
			'id': answer.id,
			'delete_flag': True,
			'is_deleted': True,
		}
	)
	output.is_valid(raise_exception=True)
	return Response(output.data, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def undelete_answer(request, answer_id):
	user = request.user

	try:
		answer = Post.objects.select_related('team').get(id=answer_id, type=1)
	except Post.DoesNotExist:
		return Response({'error': 'Answer not found'}, status=status.HTTP_404_NOT_FOUND)

	membership_error = ensure_team_membership(team=answer.team, user=user)
	if membership_error:
		return membership_error

	if answer.user_id != user.id:
		return Response({'error': 'Only the answer author can undelete this answer'}, status=status.HTTP_403_FORBIDDEN)

	if answer.delete_flag:
		Post.objects.filter(id=answer.id).update(delete_flag=False)
		if answer.parent_id:
			Post.objects.filter(id=answer.parent_id).update(answer_count=Coalesce(F('answer_count'), 0) + 1)

	output = PostDeleteStateOutputSerializer(
		data={
			'id': answer.id,
			'delete_flag': False,
			'is_deleted': False,
		}
	)
	output.is_valid(raise_exception=True)
	return Response(output.data, status=status.HTTP_200_OK)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def approve_answer(request, question_id):
	user = request.user

	approve_input_serializer = ApproveAnswerInputSerializer(data=request.data)
	if not approve_input_serializer.is_valid():
		return Response(
			{'error': _first_serializer_error(approve_input_serializer.errors)},
			status=status.HTTP_400_BAD_REQUEST,
		)

	try:
		question = Post.objects.select_related('team', 'approved_answer').get(id=question_id, type=0, delete_flag=False)
	except Post.DoesNotExist:
		return Response({'error': 'Question not found'}, status=status.HTTP_404_NOT_FOUND)

	membership_error = ensure_team_membership(team=question.team, user=user)
	if membership_error:
		return membership_error

	if question.user_id != user.id:
		return Response({'error': 'Only the question author can approve an answer'}, status=status.HTTP_403_FORBIDDEN)

	if question.delete_flag:
		return Response({'error': 'Cannot approve answers for a deleted question'}, status=status.HTTP_400_BAD_REQUEST)

	answer_id = approve_input_serializer.validated_data.get('answer_id')
	if answer_id is None:
		with transaction.atomic():
			previous_approved_answer = question.approved_answer
			question.approved_answer = None
			question.save(update_fields=['approved_answer', 'modified_at'])

			if previous_approved_answer and previous_approved_answer.user_id != user.id:
				apply_reputation_change(
					user=previous_approved_answer.user,
					team=question.team,
					triggered_by=user,
					post=previous_approved_answer,
					points=ANSWER_UNACCEPT_LOSS,
					reason=REPUTATION_REASON_UNACCEPT,
				)

		output = ApproveAnswerOutputSerializer(
			data={
				'question_id': question.id,
				'approved_answer': question.approved_answer_id,
			}
		)
		output.is_valid(raise_exception=True)
		return Response(output.data, status=status.HTTP_200_OK)

	try:
		answer = Post.objects.get(
			id=answer_id,
			type=1,
			parent_id=question.id,
			delete_flag=False,
		)
	except Post.DoesNotExist:
		return Response({'error': 'Answer not found for this question'}, status=status.HTTP_404_NOT_FOUND)

	with transaction.atomic():
		previous_approved_answer = question.approved_answer
		already_approved = previous_approved_answer and previous_approved_answer.id == answer.id

		question.approved_answer = answer
		question.save(update_fields=['approved_answer', 'modified_at'])

		if previous_approved_answer and not already_approved and previous_approved_answer.user_id != user.id:
			apply_reputation_change(
				user=previous_approved_answer.user,
				team=question.team,
				triggered_by=user,
				post=previous_approved_answer,
				points=ANSWER_UNACCEPT_LOSS,
				reason=REPUTATION_REASON_UNACCEPT,
			)

		if not already_approved and answer.user_id != user.id:
			apply_reputation_change(
				user=answer.user,
				team=question.team,
				triggered_by=user,
				post=answer,
				points=ANSWER_ACCEPT_GAIN,
				reason=REPUTATION_REASON_ACCEPT,
			)

	create_notification(
		post=answer,
		user=answer.user,
		triggered_by=user,
		reason=NOTIFICATION_REASON_YOUR_ANSWER_WAS_APPROVED,
	)
	_notify_question_followers(
		question=question,
		triggered_by=user,
		reason=NOTIFICATION_REASON_APPROVED_ANSWER_ON_FOLLOWED_POST,
	)

	output = ApproveAnswerOutputSerializer(
		data={
			'question_id': question.id,
			'approved_answer': question.approved_answer_id,
		}
	)
	output.is_valid(raise_exception=True)
	return Response(output.data, status=status.HTTP_200_OK)
