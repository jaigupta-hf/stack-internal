from django.db import transaction

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from teams.permissions import ensure_team_membership

from ..domain_events import answer_approval_changed, emit_post_event
from ..models import Post, PostVersion
from ..services import PostService

from .serializers import (
	ApproveAnswerInputSerializer,
	ApproveAnswerOutputSerializer,
	CreateAnswerOutputSerializer,
	CreateAnswerSerializer,
	CreateQuestionOutputSerializer,
	CreateQuestionSerializer,
	PostDeleteStateOutputSerializer,
	PostVersionOutputSerializer,
	UpdateAnswerInputSerializer,
	UpdateAnswerOutputSerializer,
)
from .views_common import (
	_first_serializer_error,
)
from .views_questions import (
	search_global_titles,
	search_questions,
)
from .views_bookmarks import (
	add_bookmark,
	list_bookmarks,
	list_followed_posts,
	remove_bookmark,
)


# Handle create question.
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
	tags = serializer.validated_data.get('tags', [])

	membership_error = ensure_team_membership(team=team, user=user)
	if membership_error:
		return membership_error

	post = PostService.create_question(
		user=user,
		team=team,
		title=title,
		body=body,
		tags=tags,
	)

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


# Handle create answer.
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

	answer = PostService.create_answer(question=question, actor=user, body=body)

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


# Handle update answer.
@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def update_answer(request, answer_id):
	user = request.user

	try:
		answer = Post.objects.select_related('user').get(id=answer_id, type=1, delete_flag=False)
	except Post.DoesNotExist:
		return Response({'error': 'Answer not found'}, status=status.HTTP_404_NOT_FOUND)

	membership_error = ensure_team_membership(team=answer.team, user=user)
	if membership_error:
		return membership_error

	if answer.user_id != user.id:
		return Response({'error': 'Only the answer author can edit this answer'}, status=status.HTTP_403_FORBIDDEN)

	update_serializer = UpdateAnswerInputSerializer(data=request.data)
	if not update_serializer.is_valid():
		return Response(update_serializer.errors, status=status.HTTP_400_BAD_REQUEST)
	body = update_serializer.validated_data['body']

	PostService.update_answer(answer=answer, actor=user, body=body)

	output = UpdateAnswerOutputSerializer(
		data={
			'id': answer.id,
			'body': answer.body,
			'created_at': answer.created_at,
			'modified_at': answer.modified_at,
			'user': answer.user_id,
			'user_name': answer.user.name,
			'vote_count': answer.vote_count,
		}
	)
	output.is_valid(raise_exception=True)
	return Response(output.data, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_post_versions(request, post_id):
	try:
		post = Post.objects.select_related('team').get(id=post_id)
	except Post.DoesNotExist:
		return Response({'error': 'Post not found'}, status=status.HTTP_404_NOT_FOUND)

	membership_error = ensure_team_membership(team=post.team, user=request.user)
	if membership_error:
		return membership_error

	versions = post.versions.order_by('version')
	serializer = PostVersionOutputSerializer(versions, many=True)
	return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def retrieve_post_version(request, post_id, version):
	try:
		post = Post.objects.select_related('team').get(id=post_id)
	except Post.DoesNotExist:
		return Response({'error': 'Post not found'}, status=status.HTTP_404_NOT_FOUND)

	membership_error = ensure_team_membership(team=post.team, user=request.user)
	if membership_error:
		return membership_error

	try:
		version_number = int(version)
	except (TypeError, ValueError):
		return Response({'error': 'version must be an integer'}, status=status.HTTP_400_BAD_REQUEST)

	try:
		version_obj = post.versions.get(version=version_number)
	except PostVersion.DoesNotExist:
		return Response({'error': 'Version not found'}, status=status.HTTP_404_NOT_FOUND)

	serializer = PostVersionOutputSerializer(version_obj)
	return Response(serializer.data, status=status.HTTP_200_OK)


# Handle delete answer.
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

	PostService.delete_answer(answer=answer, actor=user)

	output = PostDeleteStateOutputSerializer(
		data={
			'id': answer.id,
			'delete_flag': True,
			'is_deleted': True,
		}
	)
	output.is_valid(raise_exception=True)
	return Response(output.data, status=status.HTTP_200_OK)


# Handle undelete answer.
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

	PostService.undelete_answer(answer=answer, actor=user)

	output = PostDeleteStateOutputSerializer(
		data={
			'id': answer.id,
			'delete_flag': False,
			'is_deleted': False,
		}
	)
	output.is_valid(raise_exception=True)
	return Response(output.data, status=status.HTTP_200_OK)


# Handle approve answer.
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
		previous_approved_answer_id = None
		with transaction.atomic():
			previous_approved_answer = question.approved_answer
			if previous_approved_answer:
				previous_approved_answer_id = previous_approved_answer.id
			question.approved_answer = None
			question.save(update_fields=['approved_answer', 'modified_at'])

		emit_post_event(
			answer_approval_changed,
			question_id=question.id,
			actor_id=user.id,
			previous_approved_answer_id=previous_approved_answer_id,
			approved_answer_id=None,
			already_approved=False,
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
		previous_approved_answer_id = previous_approved_answer.id if previous_approved_answer else None

		question.approved_answer = answer
		question.save(update_fields=['approved_answer', 'modified_at'])

	emit_post_event(
		answer_approval_changed,
		question_id=question.id,
		actor_id=user.id,
		previous_approved_answer_id=previous_approved_answer_id,
		approved_answer_id=answer.id,
		already_approved=bool(already_approved),
	)

	output = ApproveAnswerOutputSerializer(
		data={
			'question_id': question.id,
			'approved_answer': question.approved_answer_id,
		}
	)
	output.is_valid(raise_exception=True)
	return Response(output.data, status=status.HTTP_200_OK)
