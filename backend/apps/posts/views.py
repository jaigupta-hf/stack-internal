from datetime import timedelta

from django.db.models import F, Prefetch, Max, Q
from django.db.models.functions import Coalesce, Greatest
from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from teams.models import TeamUser
from teams.utils import get_team_member_name
from users.models import User
from apps.pagination import parse_pagination_params, paginate_queryset
from .models import Post
from .models import Bookmark
from .models import PostFollow
from .serializers import CreateQuestionSerializer, CreateAnswerSerializer, CreateArticleSerializer
from tags.api import sync_post_tags, sync_user_tags_for_post, tag_prefetch, serialize_post_tags
from notifications.api import create_notification
from notifications.models import Notification
from comments.models import Comment
from votes.models import Vote
from reputation.api import apply_reputation_change
from reputation.models import Bounty
from apps.collections.models import Collection


BOUNTY_AMOUNT = 50
BOUNTY_REASON_OPTIONS = {
	'Authoritative reference needed',
	'Canonical answer required',
	'Current answers are outdated',
	'Draw attention',
	'Improve details',
	'Reward existing answer',
}

# Article type labels
ARTICLE_TYPE_TO_LABEL = {
	20: 'Announcement',
	21: 'How-to Guide',
	22: 'Knowledge Article',
	23: 'Policy',
}


def _display_name(team_id, user_id):
	return get_team_member_name(team_id, user_id)


def _serialize_post_mentions(question):
	mentions = getattr(question, 'mention_notifications', None)
	if mentions is None:
		mentions = (
			Notification.objects.filter(post=question, reason='mentioned_in_question')
			.select_related('user', 'triggered_by')
			.order_by('created_at')
		)

	return [
		{
			'id': mention.id,
			'user_id': mention.user_id,
			'user_name': _display_name(question.team_id, mention.user_id),
			'mentioned_by': mention.triggered_by_id,
			'mentioned_by_name': _display_name(question.team_id, mention.triggered_by_id),
			'created_at': mention.created_at,
		}
		for mention in mentions
	]


def _notify_question_followers(*, question, triggered_by, reason):
	follower_ids = list(
		PostFollow.objects.filter(post=question).values_list('user_id', flat=True)
	)
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


def _serialize_bounty(bounty):
	if not bounty:
		return None

	return {
		'id': bounty.id,
		'post_id': bounty.post_id,
		'offered_by': bounty.offered_by_id,
		'awarded_answer': bounty.awarded_answer_id,
		'amount': bounty.amount,
		'status': bounty.status,
		'reason': bounty.reason,
		'start_time': bounty.start_time,
		'end_time': bounty.end_time,
	}


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

	if not TeamUser.objects.filter(team=team, user=user).exists():
		return Response({'error': 'You are not a member of this team'}, status=status.HTTP_403_FORBIDDEN)

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

	return Response(
		{
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
		},
		status=status.HTTP_201_CREATED,
	)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_article(request):
	user = request.user

	serializer = CreateArticleSerializer(data=request.data)
	if not serializer.is_valid():
		return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

	team = serializer.validated_data['team']
	title = serializer.validated_data['title']
	body = serializer.validated_data['body']
	article_type = serializer.validated_data['type']
	tag_names = serializer.validated_data['tags']

	if not TeamUser.objects.filter(team=team, user=user).exists():
		return Response({'error': 'You are not a member of this team'}, status=status.HTTP_403_FORBIDDEN)

	with transaction.atomic():
		article = Post.objects.create(
			type=article_type,
			title=title,
			body=body,
			parent=None,
			team=team,
			user=user,
			approved_answer=None,
			answer_count=None,
		)

		sync_post_tags(article, tag_names)
		sync_user_tags_for_post(user, article)

	tags_payload = [{'name': tag_name} for tag_name in tag_names]

	return Response(
		{
			'id': article.id,
			'type': article.type,
			'type_label': ARTICLE_TYPE_TO_LABEL.get(article.type, 'Article'),
			'title': article.title,
			'body': article.body,
			'parent': article.parent_id,
			'approved_answer': article.approved_answer_id,
			'answer_count': article.answer_count,
			'team': article.team_id,
			'user': article.user_id,
			'user_name': user.name,
			'tags': tags_payload,
			'created_at': article.created_at,
			'modified_at': article.modified_at,
		},
		status=status.HTTP_201_CREATED,
	)


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

	if not TeamUser.objects.filter(team=question.team, user=user).exists():
		return Response({'error': 'You are not a member of this team'}, status=status.HTTP_403_FORBIDDEN)

	if question.closed_reason:
		return Response({'error': 'This question is closed and not accepting new answers.'}, status=status.HTTP_400_BAD_REQUEST)

	serializer = CreateAnswerSerializer(data=request.data)
	if not serializer.is_valid():
		return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

	body = serializer.validated_data['body'].strip()
	if not body:
		return Response({'error': 'body cannot be empty'}, status=status.HTTP_400_BAD_REQUEST)

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
		reason='answer_posted_on_your_question',
	)
	_notify_question_followers(
		question=question,
		triggered_by=user,
		reason='new_answer_on_followed_post',
	)

	return Response(
		{
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
		},
		status=status.HTTP_201_CREATED,
	)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def update_answer(request, answer_id):
	user = request.user

	try:
		answer = Post.objects.select_related('user', 'edited_by').get(id=answer_id, type=1, delete_flag=False)
	except Post.DoesNotExist:
		return Response({'error': 'Answer not found'}, status=status.HTTP_404_NOT_FOUND)

	if not TeamUser.objects.filter(team=answer.team, user=user).exists():
		return Response({'error': 'You are not a member of this team'}, status=status.HTTP_403_FORBIDDEN)

	body = request.data.get('body')
	if body is None:
		return Response({'error': 'body is required'}, status=status.HTTP_400_BAD_REQUEST)

	body = str(body).strip()
	if not body:
		return Response({'error': 'body cannot be empty'}, status=status.HTTP_400_BAD_REQUEST)

	answer.body = body
	answer.edited_by = user
	answer.save()
	create_notification(
		post=answer,
		user=answer.user,
		triggered_by=user,
		reason='answer_edited',
	)

	return Response(
		{
			'id': answer.id,
			'body': answer.body,
			'created_at': answer.created_at,
			'modified_at': answer.modified_at,
			'user': answer.user_id,
			'user_name': answer.user.name,
			'edited_by': answer.edited_by_id,
			'edited_by_username': answer.edited_by.name if answer.edited_by else None,
			'vote_count': answer.vote_count,
		},
		status=status.HTTP_200_OK,
	)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def delete_answer(request, answer_id):
	user = request.user

	try:
		answer = Post.objects.select_related('team', 'parent').get(id=answer_id, type=1)
	except Post.DoesNotExist:
		return Response({'error': 'Answer not found'}, status=status.HTTP_404_NOT_FOUND)

	if not TeamUser.objects.filter(team=answer.team, user=user).exists():
		return Response({'error': 'You are not a member of this team'}, status=status.HTTP_403_FORBIDDEN)

	if answer.user_id != user.id:
		return Response({'error': 'Only the answer author can delete this answer'}, status=status.HTTP_403_FORBIDDEN)

	if not answer.delete_flag:
		Post.objects.filter(id=answer.id).update(delete_flag=True)
		if answer.parent_id:
			Post.objects.filter(id=answer.parent_id).update(
				answer_count=Greatest(Coalesce(F('answer_count'), 0) - 1, 0)
			)
			Post.objects.filter(id=answer.parent_id, approved_answer_id=answer.id).update(approved_answer=None)

	return Response(
		{
			'id': answer.id,
			'delete_flag': True,
			'is_deleted': True,
		},
		status=status.HTTP_200_OK,
	)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def undelete_answer(request, answer_id):
	user = request.user

	try:
		answer = Post.objects.select_related('team').get(id=answer_id, type=1)
	except Post.DoesNotExist:
		return Response({'error': 'Answer not found'}, status=status.HTTP_404_NOT_FOUND)

	if not TeamUser.objects.filter(team=answer.team, user=user).exists():
		return Response({'error': 'You are not a member of this team'}, status=status.HTTP_403_FORBIDDEN)

	if answer.user_id != user.id:
		return Response({'error': 'Only the answer author can undelete this answer'}, status=status.HTTP_403_FORBIDDEN)

	if answer.delete_flag:
		Post.objects.filter(id=answer.id).update(delete_flag=False)
		if answer.parent_id:
			Post.objects.filter(id=answer.parent_id).update(answer_count=Coalesce(F('answer_count'), 0) + 1)

	return Response(
		{
			'id': answer.id,
			'delete_flag': False,
			'is_deleted': False,
		},
		status=status.HTTP_200_OK,
	)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def approve_answer(request, question_id):
	user = request.user

	try:
		question = Post.objects.select_related('team', 'approved_answer').get(id=question_id, type=0, delete_flag=False)
	except Post.DoesNotExist:
		return Response({'error': 'Question not found'}, status=status.HTTP_404_NOT_FOUND)

	if not TeamUser.objects.filter(team=question.team, user=user).exists():
		return Response({'error': 'You are not a member of this team'}, status=status.HTTP_403_FORBIDDEN)

	if question.user_id != user.id:
		return Response({'error': 'Only the question author can approve an answer'}, status=status.HTTP_403_FORBIDDEN)

	if question.delete_flag:
		return Response({'error': 'Cannot approve answers for a deleted question'}, status=status.HTTP_400_BAD_REQUEST)

	answer_id = request.data.get('answer_id')
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
					points=-15,
					reason='unaccept',
				)

		return Response(
			{
				'question_id': question.id,
				'approved_answer': question.approved_answer_id,
			},
			status=status.HTTP_200_OK,
		)

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
				points=-15,
				reason='unaccept',
			)

		if not already_approved and answer.user_id != user.id:
			apply_reputation_change(
				user=answer.user,
				team=question.team,
				triggered_by=user,
				post=answer,
				points=15,
				reason='accept',
			)

	create_notification(
		post=answer,
		user=answer.user,
		triggered_by=user,
		reason='your_answer_was_approved',
	)
	_notify_question_followers(
		question=question,
		triggered_by=user,
		reason='approved_answer_on_followed_post',
	)

	return Response(
		{
			'question_id': question.id,
			'approved_answer': question.approved_answer_id,
		},
		status=status.HTTP_200_OK,
	)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_questions(request):
	user = request.user

	team_id = request.query_params.get('team_id')
	if not team_id:
		return Response({'error': 'team_id is required'}, status=status.HTTP_400_BAD_REQUEST)

	if not TeamUser.objects.filter(team_id=team_id, user=user).exists():
		return Response({'error': 'You are not a member of this team'}, status=status.HTTP_403_FORBIDDEN)

	page, page_size = parse_pagination_params(request)

	questions = (
		Post.objects.filter(team_id=team_id, type=0, delete_flag=False)
		.annotate(
			latest_answer_activity_at=Max(
				'child_posts__created_at',
				filter=Q(child_posts__type=1, child_posts__delete_flag=False),
			)
		)
		.select_related('user', 'closed_by', 'parent')
		.prefetch_related(tag_prefetch('question_tag_posts'))
		.order_by('-created_at')
	)
	questions, pagination = paginate_queryset(questions, page=page, page_size=page_size)

	question_ids = [question.id for question in questions]
	question_user_ids = [question.user_id for question in questions]
	admin_user_ids = set(
		TeamUser.objects.filter(team_id=team_id, user_id__in=question_user_ids, is_admin=True).values_list('user_id', flat=True)
	)
	post_vote_map = {
		item['post_id']: item['vote']
		for item in Vote.objects.filter(
			user=user,
			post_id__in=question_ids,
			comment__isnull=True,
		).values('post_id', 'vote')
	}
	bookmarked_post_ids = set(
		Bookmark.objects.filter(user=user, post_id__in=question_ids).values_list('post_id', flat=True)
	)

	data = [
		{
			'id': question.id,
			'title': question.title,
			'body': question.body,
			'bounty_amount': question.bounty_amount,
			'user_id': question.user_id,
			'user_is_admin': question.user_id in admin_user_ids,
			'parent': question.parent_id,
			'tags': serialize_post_tags(question, 'question_tag_posts'),
			'answer_count': question.answer_count or 0,
			'approved_answer': question.approved_answer_id,
			'views_count': question.views_count,
			'vote_count': question.vote_count,
			'bookmarks_count': question.bookmarks_count,
			'current_user_vote': post_vote_map.get(question.id, 0),
			'is_bookmarked': question.id in bookmarked_post_ids,
			'is_closed': bool(question.closed_reason),
			'closed_reason': question.closed_reason,
			'closed_at': question.closed_at,
			'closed_by': question.closed_by_id,
			'closed_by_username': _display_name(question.team_id, question.closed_by_id) if question.closed_by else None,
			'duplicate_post_id': question.parent_id if question.closed_reason == 'duplicate' else None,
			'duplicate_post_title': question.parent.title if question.closed_reason == 'duplicate' and question.parent else None,
			'user_name': _display_name(question.team_id, question.user_id),
			'created_at': question.created_at,
			'latest_activity_at': question.latest_answer_activity_at or question.created_at,
		}
		for question in questions
	]
	return Response({'items': data, 'pagination': pagination}, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def search_questions(request):
	user = request.user

	team_id = request.query_params.get('team_id')
	if not team_id:
		return Response({'error': 'team_id is required'}, status=status.HTTP_400_BAD_REQUEST)

	if not TeamUser.objects.filter(team_id=team_id, user=user).exists():
		return Response({'error': 'You are not a member of this team'}, status=status.HTTP_403_FORBIDDEN)

	query = str(request.query_params.get('q', '')).strip()

	questions = Post.objects.filter(team_id=team_id, type=0).select_related('user').order_by('-created_at')
	if query:
		questions = questions.filter(title__icontains=query)

	payload = [
		{
			'id': item.id,
			'title': item.title,
			'user_name': _display_name(team_id, item.user_id),
			'created_at': item.created_at,
			'delete_flag': item.delete_flag,
			'is_closed': bool(item.closed_reason),
			'closed_reason': item.closed_reason,
		}
		for item in questions[:12]
	]

	return Response(payload, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def search_global_titles(request):
	user = request.user

	team_id = request.query_params.get('team_id')
	if not team_id:
		return Response({'error': 'team_id is required'}, status=status.HTTP_400_BAD_REQUEST)

	if not TeamUser.objects.filter(team_id=team_id, user=user).exists():
		return Response({'error': 'You are not a member of this team'}, status=status.HTTP_403_FORBIDDEN)

	query = str(request.query_params.get('q', '')).strip()
	if not query:
		return Response([], status=status.HTTP_200_OK)

	question_posts = (
		Post.objects.filter(team_id=team_id, type=0, delete_flag=False, title__icontains=query)
		.select_related('user')
		.order_by('-created_at')[:10]
	)
	article_posts = (
		Post.objects.filter(team_id=team_id, type__in=(20, 21, 22, 23), delete_flag=False, title__icontains=query)
		.select_related('user')
		.order_by('-created_at')[:10]
	)
	collections = (
		Collection.objects.filter(team_id=team_id, title__icontains=query)
		.select_related('user')
		.order_by('-created_at')[:10]
	)

	results = [
		{
			'id': item.id,
			'type': 'question',
			'title': item.title,
			'user_name': _display_name(team_id, item.user_id),
			'created_at': item.created_at,
			'delete_flag': item.delete_flag,
		}
		for item in question_posts
	]
	results.extend(
		[
			{
				'id': item.id,
				'type': 'article',
				'title': item.title,
				'user_name': _display_name(team_id, item.user_id),
				'created_at': item.created_at,
			}
			for item in article_posts
		]
	)
	results.extend(
		[
			{
				'id': item.id,
				'type': 'collection',
				'title': item.title,
				'user_name': _display_name(team_id, item.user_id),
				'created_at': item.created_at,
			}
			for item in collections
		]
	)

	results.sort(key=lambda item: item.get('created_at') or timezone.now(), reverse=True)
	return Response(results[:20], status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def close_question(request, question_id):
	user = request.user

	try:
		question = Post.objects.select_related('team').get(id=question_id, type=0, delete_flag=False)
	except Post.DoesNotExist:
		return Response({'error': 'Question not found'}, status=status.HTTP_404_NOT_FOUND)

	if not TeamUser.objects.filter(team=question.team, user=user).exists():
		return Response({'error': 'You are not a member of this team'}, status=status.HTTP_403_FORBIDDEN)

	if question.closed_reason:
		return Response({'error': 'Question is already closed.'}, status=status.HTTP_400_BAD_REQUEST)

	reason_value = str(request.data.get('reason', '')).strip().lower()
	if reason_value in ('off_topic', 'offtopic'):
		reason_value = 'off-topic'

	if reason_value not in ('duplicate', 'off-topic'):
		return Response({'error': 'reason must be either duplicate or off-topic'}, status=status.HTTP_400_BAD_REQUEST)

	duplicate_question = None
	duplicate_post_id_value = None
	duplicate_post_title_value = None
	if reason_value == 'duplicate':
		duplicate_post_id = request.data.get('duplicate_post_id')
		if not duplicate_post_id:
			return Response({'error': 'duplicate_post_id is required for duplicate close reason'}, status=status.HTTP_400_BAD_REQUEST)

		try:
			duplicate_post_id = int(duplicate_post_id)
		except (TypeError, ValueError):
			return Response({'error': 'duplicate_post_id must be an integer'}, status=status.HTTP_400_BAD_REQUEST)

		if duplicate_post_id == question.id:
			return Response({'error': 'A question cannot be duplicate of itself'}, status=status.HTTP_400_BAD_REQUEST)

		try:
			duplicate_question = Post.objects.get(id=duplicate_post_id, team=question.team, type=0, delete_flag=False)
		except Post.DoesNotExist:
			return Response({'error': 'Duplicate reference question not found in this team'}, status=status.HTTP_404_NOT_FOUND)

		duplicate_post_id_value = duplicate_question.id
		duplicate_post_title_value = duplicate_question.title

	closed_at = timezone.now()
	Post.objects.filter(id=question.id).update(
		closed_reason=reason_value,
		closed_by=user,
		closed_at=closed_at,
		parent=duplicate_question if reason_value == 'duplicate' else None,
	)
	create_notification(
		post=question,
		user=question.user,
		triggered_by=user,
		reason='question_closed',
	)

	return Response(
		{
			'id': question.id,
			'is_closed': True,
			'closed_reason': reason_value,
			'closed_at': closed_at,
			'closed_by': user.id,
			'closed_by_username': _display_name(question.team_id, user.id),
			'duplicate_post_id': duplicate_post_id_value,
			'duplicate_post_title': duplicate_post_title_value,
		},
		status=status.HTTP_200_OK,
	)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reopen_question(request, question_id):
	user = request.user

	try:
		question = Post.objects.select_related('team').get(id=question_id, type=0, delete_flag=False)
	except Post.DoesNotExist:
		return Response({'error': 'Question not found'}, status=status.HTTP_404_NOT_FOUND)

	if not TeamUser.objects.filter(team=question.team, user=user).exists():
		return Response({'error': 'You are not a member of this team'}, status=status.HTTP_403_FORBIDDEN)

	if not question.closed_reason:
		return Response({'error': 'Question is not closed.'}, status=status.HTTP_400_BAD_REQUEST)

	Post.objects.filter(id=question.id).update(
		closed_reason='',
		closed_by=None,
		closed_at=None,
		parent=None,
	)

	return Response(
		{
			'id': question.id,
			'is_closed': False,
			'closed_reason': '',
			'closed_at': None,
			'closed_by': None,
			'closed_by_username': None,
			'duplicate_post_id': None,
			'duplicate_post_title': None,
		},
		status=status.HTTP_200_OK,
	)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def delete_question(request, question_id):
	user = request.user

	try:
		question = Post.objects.select_related('team').get(id=question_id, type=0)
	except Post.DoesNotExist:
		return Response({'error': 'Question not found'}, status=status.HTTP_404_NOT_FOUND)

	if not TeamUser.objects.filter(team=question.team, user=user).exists():
		return Response({'error': 'You are not a member of this team'}, status=status.HTTP_403_FORBIDDEN)

	if not question.delete_flag:
		Post.objects.filter(id=question.id).update(delete_flag=True)
		create_notification(
			post=question,
			user=question.user,
			triggered_by=user,
			reason='question_deleted',
		)

	return Response(
		{
			'id': question.id,
			'delete_flag': True,
			'is_deleted': True,
		},
		status=status.HTTP_200_OK,
	)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def undelete_question(request, question_id):
	user = request.user

	try:
		question = Post.objects.select_related('team').get(id=question_id, type=0)
	except Post.DoesNotExist:
		return Response({'error': 'Question not found'}, status=status.HTTP_404_NOT_FOUND)

	if not TeamUser.objects.filter(team=question.team, user=user).exists():
		return Response({'error': 'You are not a member of this team'}, status=status.HTTP_403_FORBIDDEN)

	if question.delete_flag:
		Post.objects.filter(id=question.id).update(delete_flag=False)

	return Response(
		{
			'id': question.id,
			'delete_flag': False,
			'is_deleted': False,
		},
		status=status.HTTP_200_OK,
	)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_articles(request):
	user = request.user

	team_id = request.query_params.get('team_id')
	if not team_id:
		return Response({'error': 'team_id is required'}, status=status.HTTP_400_BAD_REQUEST)

	if not TeamUser.objects.filter(team_id=team_id, user=user).exists():
		return Response({'error': 'You are not a member of this team'}, status=status.HTTP_403_FORBIDDEN)

	articles = (
		Post.objects.filter(team_id=team_id, type__in=(20, 21, 22, 23), delete_flag=False)
		.select_related('user')
		.prefetch_related(tag_prefetch('article_tag_posts'))
		.order_by('-created_at')
	)

	article_ids = [article.id for article in articles]
	post_vote_map = {
		item['post_id']: item['vote']
		for item in Vote.objects.filter(
			user=user,
			post_id__in=article_ids,
			comment__isnull=True,
		).values('post_id', 'vote')
	}
	bookmarked_post_ids = set(
		Bookmark.objects.filter(user=user, post_id__in=article_ids).values_list('post_id', flat=True)
	)

	data = [
		{
			'id': article.id,
			'type': article.type,
			'type_label': ARTICLE_TYPE_TO_LABEL.get(article.type, 'Article'),
			'title': article.title,
			'body': article.body,
			'tags': serialize_post_tags(article, 'article_tag_posts'),
			'user_name': _display_name(article.team_id, article.user_id),
			'created_at': article.created_at,
			'views_count': article.views_count,
			'vote_count': article.vote_count,
			'bookmarks_count': article.bookmarks_count,
			'current_user_vote': post_vote_map.get(article.id, 0),
			'is_bookmarked': article.id in bookmarked_post_ids,
		}
		for article in articles
	]

	return Response(data, status=status.HTTP_200_OK)


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def article_detail(request, article_id):
	user = request.user

	try:
		article = (
			Post.objects.select_related('user')
			.prefetch_related(tag_prefetch('article_tag_posts'))
			.get(id=article_id, type__in=(20, 21, 22, 23), delete_flag=False)
		)
	except Post.DoesNotExist:
		return Response({'error': 'Article not found'}, status=status.HTTP_404_NOT_FOUND)

	if not TeamUser.objects.filter(team=article.team, user=user).exists():
		return Response({'error': 'You are not a member of this team'}, status=status.HTTP_403_FORBIDDEN)

	if request.method == 'PATCH':
		if article.user_id != user.id:
			return Response({'error': 'Only the author can edit this article'}, status=status.HTTP_403_FORBIDDEN)

		title = request.data.get('title')
		body = request.data.get('body')
		article_type = request.data.get('type')
		tags = request.data.get('tags')

		if title is None or body is None or article_type is None or tags is None:
			return Response({'error': 'title, body, type, and tags are required'}, status=status.HTTP_400_BAD_REQUEST)

		title = str(title).strip()
		body = str(body).strip()

		if not title or not body:
			return Response({'error': 'title and body cannot be empty'}, status=status.HTTP_400_BAD_REQUEST)

		try:
			article_type = int(article_type)
		except (TypeError, ValueError):
			return Response({'error': 'Invalid article type.'}, status=status.HTTP_400_BAD_REQUEST)

		if article_type not in ARTICLE_TYPE_TO_LABEL:
			return Response({'error': 'Invalid article type.'}, status=status.HTTP_400_BAD_REQUEST)

		if not isinstance(tags, list):
			return Response({'error': 'tags must be a list'}, status=status.HTTP_400_BAD_REQUEST)

		if len(tags) < 1:
			return Response({'error': 'At least 1 tag is required.'}, status=status.HTTP_400_BAD_REQUEST)

		if len(tags) > 5:
			return Response({'error': 'Maximum 5 tags are allowed.'}, status=status.HTTP_400_BAD_REQUEST)

		with transaction.atomic():
			article.title = title
			article.body = body
			article.type = article_type
			article.edited_by = user
			article.save()
			sync_post_tags(article, tags)

		article = (
			Post.objects.select_related('user')
			.prefetch_related(tag_prefetch('article_tag_posts'))
			.get(id=article_id, type__in=(20, 21, 22, 23), delete_flag=False)
		)

		return Response(
			{
				'id': article.id,
				'type': article.type,
				'type_label': ARTICLE_TYPE_TO_LABEL.get(article.type, 'Article'),
				'title': article.title,
				'body': article.body,
				'tags': serialize_post_tags(article, 'article_tag_posts'),
				'user': article.user_id,
				'user_name': _display_name(article.team_id, article.user_id),
				'created_at': article.created_at,
				'modified_at': article.modified_at,
				'views_count': article.views_count,
			},
			status=status.HTTP_200_OK,
		)

	Post.objects.filter(id=article.id).update(views_count=F('views_count') + 1)
	article.refresh_from_db(fields=['views_count'])

	comments = (
		Comment.objects.filter(post_id=article.id)
		.select_related('user')
		.order_by('created_at')
	)

	comment_ids = [comment.id for comment in comments]
	comment_vote_map = {
		item['comment_id']: item['vote']
		for item in Vote.objects.filter(
			user=user,
			comment_id__in=comment_ids,
			post__isnull=True,
		).values('comment_id', 'vote')
	}

	article_vote = (
		Vote.objects.filter(user=user, post_id=article.id, comment__isnull=True)
		.values_list('vote', flat=True)
		.first()
	)
	is_bookmarked = Bookmark.objects.filter(user=user, post_id=article.id).exists()

	comments_payload = [
		{
			'id': comment.id,
			'body': comment.body,
			'created_at': comment.created_at,
			'modified_at': comment.modified_at,
			'user': comment.user_id,
			'user_name': _display_name(article.team_id, comment.user_id),
			'vote_count': comment.vote_count,
			'parent_comment': comment.parent_comment_id,
			'current_user_vote': comment_vote_map.get(comment.id, 0),
		}
		for comment in comments
	]

	return Response(
		{
			'id': article.id,
			'type': article.type,
			'type_label': ARTICLE_TYPE_TO_LABEL.get(article.type, 'Article'),
			'title': article.title,
			'body': article.body,
			'tags': serialize_post_tags(article, 'article_tag_posts'),
			'user': article.user_id,
			'user_name': _display_name(article.team_id, article.user_id),
			'created_at': article.created_at,
			'modified_at': article.modified_at,
			'views_count': article.views_count,
			'vote_count': article.vote_count,
			'bookmarks_count': article.bookmarks_count,
			'current_user_vote': article_vote or 0,
			'is_bookmarked': is_bookmarked,
			'comments': comments_payload,
		},
		status=status.HTTP_200_OK,
	)


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def question_detail(request, question_id):
	user = request.user

	try:
		answer_queryset = (
			Post.objects.filter(type=1)
			.filter(Q(delete_flag=False) | Q(delete_flag=True, user=user))
			.select_related('user', 'edited_by')
			.order_by('created_at')
		)

		question = (
			Post.objects.select_related('user', 'edited_by', 'closed_by', 'parent')
			.prefetch_related(
				Prefetch(
					'child_posts',
					queryset=answer_queryset,
					to_attr='answer_posts',
				),
				Prefetch(
					'notifications',
					queryset=Notification.objects.filter(reason='mentioned_in_question')
					.select_related('user', 'triggered_by')
					.order_by('created_at'),
					to_attr='mention_notifications',
				),
				tag_prefetch('question_tag_posts'),
			)
			.get(id=question_id, type=0)
		)
	except Post.DoesNotExist:
		return Response({'error': 'Question not found'}, status=status.HTTP_404_NOT_FOUND)

	if not TeamUser.objects.filter(team=question.team, user=user).exists():
		return Response({'error': 'You are not a member of this team'}, status=status.HTTP_403_FORBIDDEN)

	if request.method == 'PATCH':
		title = request.data.get('title')
		body = request.data.get('body')
		tags = request.data.get('tags', None)

		if title is None or body is None:
			return Response({'error': 'title and body are required'}, status=status.HTTP_400_BAD_REQUEST)

		title = str(title).strip()
		body = str(body).strip()

		if not title or not body:
			return Response({'error': 'title and body cannot be empty'}, status=status.HTTP_400_BAD_REQUEST)

		if tags is not None:
			if not isinstance(tags, list):
				return Response({'error': 'tags must be a list'}, status=status.HTTP_400_BAD_REQUEST)
			if len(tags) > 5:
				return Response({'error': 'Maximum 5 tags are allowed.'}, status=status.HTTP_400_BAD_REQUEST)

		with transaction.atomic():
			question.title = title
			question.body = body
			question.edited_by = user
			question.save()

			if tags is not None:
				sync_post_tags(question, tags)

		create_notification(
			post=question,
			user=question.user,
			triggered_by=user,
			reason='question_edited',
		)

		question = (
			Post.objects.select_related('user', 'edited_by', 'closed_by', 'parent')
			.prefetch_related(
				Prefetch(
					'child_posts',
					queryset=answer_queryset,
					to_attr='answer_posts',
				),
				Prefetch(
					'notifications',
					queryset=Notification.objects.filter(reason='mentioned_in_question')
					.select_related('user', 'triggered_by')
					.order_by('created_at'),
					to_attr='mention_notifications',
				),
				tag_prefetch('question_tag_posts'),
			)
			.get(id=question_id, type=0)
		)
	else:
		Post.objects.filter(id=question.id).update(views_count=F('views_count') + 1)
		question.refresh_from_db(fields=['views_count'])

	def serialize_comment(comment):
		return {
			'id': comment.id,
			'body': comment.body,
			'created_at': comment.created_at,
			'modified_at': comment.modified_at,
			'user': comment.user_id,
			'user_name': _display_name(question.team_id, comment.user_id),
			'vote_count': comment.vote_count,
			'parent_comment': comment.parent_comment_id,
		}

	answer_posts = getattr(question, 'answer_posts', [])
	post_ids = [question.id, *[answer.id for answer in answer_posts]]
	is_bookmarked = Bookmark.objects.filter(user=user, post_id=question.id).exists()
	comments = (
		Comment.objects.filter(post_id__in=post_ids)
		.select_related('user')
		.order_by('created_at')
	)

	comments_by_post_id = {}
	for comment in comments:
		comments_by_post_id.setdefault(comment.post_id, []).append(serialize_comment(comment))

	comment_ids = [comment.id for comment in comments]
	post_vote_map = {
		item['post_id']: item['vote']
		for item in Vote.objects.filter(
			user=user,
			post_id__in=post_ids,
			comment__isnull=True,
		).values('post_id', 'vote')
	}
	comment_vote_map = {
		item['comment_id']: item['vote']
		for item in Vote.objects.filter(
			user=user,
			comment_id__in=comment_ids,
			post__isnull=True,
		).values('comment_id', 'vote')
	}

	for post_id, post_comments in comments_by_post_id.items():
		for comment in post_comments:
			comment['current_user_vote'] = comment_vote_map.get(comment['id'], 0)

	answers_payload = [
		{
			'id': answer.id,
			'body': answer.body,
			'delete_flag': answer.delete_flag,
			'created_at': answer.created_at,
			'modified_at': answer.modified_at,
			'user': answer.user_id,
			'user_name': _display_name(question.team_id, answer.user_id),
			'edited_by': answer.edited_by_id,
			'edited_by_username': answer.edited_by.name if answer.edited_by else None,
			'vote_count': answer.vote_count,
			'current_user_vote': post_vote_map.get(answer.id, 0),
			'comments': comments_by_post_id.get(answer.id, []),
		}
		for answer in answer_posts
	]

	tags_payload = serialize_post_tags(question, 'question_tag_posts')
	mentions_payload = _serialize_post_mentions(question)
	is_following = PostFollow.objects.filter(post=question, user=user).exists()
	followers_count = PostFollow.objects.filter(post=question).count()
	bounty = Bounty.objects.filter(post=question).order_by('-start_time').first()

	return Response(
		{
			'id': question.id,
			'title': question.title,
			'body': question.body,
			'delete_flag': question.delete_flag,
			'bounty_amount': question.bounty_amount,
			'parent': question.parent_id,
			'created_at': question.created_at,
			'modified_at': question.modified_at,
			'team': question.team_id,
			'user': question.user_id,
			'user_name': _display_name(question.team_id, question.user_id),
			'edited_by': question.edited_by_id,
			'edited_by_username': question.edited_by.name if question.edited_by else None,
			'views_count': question.views_count,
			'vote_count': question.vote_count,
			'bookmarks_count': question.bookmarks_count,
			'current_user_vote': post_vote_map.get(question.id, 0),
			'approved_answer': question.approved_answer_id,
			'can_approve_answers': question.user_id == user.id and not question.delete_flag,
			'is_following': is_following,
			'followers_count': followers_count,
			'is_bookmarked': is_bookmarked,
			'is_closed': bool(question.closed_reason),
			'closed_reason': question.closed_reason,
			'closed_at': question.closed_at,
			'closed_by': question.closed_by_id,
			'closed_by_username': _display_name(question.team_id, question.closed_by_id) if question.closed_by else None,
			'duplicate_post_id': question.parent_id if question.closed_reason == 'duplicate' else None,
			'duplicate_post_title': question.parent.title if question.closed_reason == 'duplicate' and question.parent else None,
			'tags': tags_payload,
			'mentions': mentions_payload,
			'bounty': _serialize_bounty(bounty),
			'can_offer_bounty': (
				question.user_id == user.id
				and not question.delete_flag
				and not bool(question.closed_reason)
				and (question.bounty_amount or 0) == 0
			),
			'can_award_bounty': question.user_id == user.id and (question.bounty_amount or 0) > 0,
			'comments': comments_by_post_id.get(question.id, []),
			'answers': answers_payload,
		},
		status=status.HTTP_200_OK,
	)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def offer_question_bounty(request, question_id):
	user = request.user

	try:
		question = Post.objects.select_related('team').get(id=question_id, type=0)
	except Post.DoesNotExist:
		return Response({'error': 'Question not found'}, status=status.HTTP_404_NOT_FOUND)

	if not TeamUser.objects.filter(team=question.team, user=user).exists():
		return Response({'error': 'You are not a member of this team'}, status=status.HTTP_403_FORBIDDEN)

	if question.user_id != user.id:
		return Response({'error': 'Only the question author can offer bounty'}, status=status.HTTP_403_FORBIDDEN)

	if question.delete_flag:
		return Response({'error': 'Cannot offer bounty on a deleted question'}, status=status.HTTP_400_BAD_REQUEST)

	if question.closed_reason:
		return Response({'error': 'Cannot offer bounty on a closed question'}, status=status.HTTP_400_BAD_REQUEST)

	if (question.bounty_amount or 0) > 0:
		return Response({'error': 'This question already has an active bounty'}, status=status.HTTP_400_BAD_REQUEST)

	reason = str(request.data.get('reason', '')).strip()
	if reason not in BOUNTY_REASON_OPTIONS:
		return Response({'error': 'Invalid bounty reason'}, status=status.HTTP_400_BAD_REQUEST)

	membership = TeamUser.objects.filter(team=question.team, user=user).first()
	if not membership:
		return Response({'error': 'You are not a member of this team'}, status=status.HTTP_403_FORBIDDEN)

	current_reputation = membership.reputation if membership.reputation and membership.reputation > 0 else 1
	if current_reputation < (BOUNTY_AMOUNT + 1):
		return Response(
			{'error': f'You need at least {BOUNTY_AMOUNT + 1} reputation to offer this bounty.'},
			status=status.HTTP_400_BAD_REQUEST,
		)

	with transaction.atomic():
		start_time = timezone.now()
		end_time = start_time + timedelta(days=7)
		bounty = Bounty.objects.create(
			post=question,
			offered_by=user,
			awarded_answer=None,
			amount=BOUNTY_AMOUNT,
			status=Bounty.STATUS_OFFERED,
			reason=reason,
			start_time=start_time,
			end_time=end_time,
		)
		Post.objects.filter(id=question.id).update(bounty_amount=BOUNTY_AMOUNT)
		question.refresh_from_db(fields=['bounty_amount'])

	return Response(
		{
			'question_id': question.id,
			'bounty_amount': question.bounty_amount,
			'bounty': _serialize_bounty(bounty),
		},
		status=status.HTTP_200_OK,
	)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def award_question_bounty(request, question_id):
	user = request.user

	try:
		question = Post.objects.select_related('team', 'user').get(id=question_id, type=0)
	except Post.DoesNotExist:
		return Response({'error': 'Question not found'}, status=status.HTTP_404_NOT_FOUND)

	if not TeamUser.objects.filter(team=question.team, user=user).exists():
		return Response({'error': 'You are not a member of this team'}, status=status.HTTP_403_FORBIDDEN)

	if question.user_id != user.id:
		return Response({'error': 'Only the question author can award bounty'}, status=status.HTTP_403_FORBIDDEN)

	if (question.bounty_amount or 0) <= 0:
		return Response({'error': 'No active bounty to award'}, status=status.HTTP_400_BAD_REQUEST)

	answer_id = request.data.get('answer_id')
	if not answer_id:
		return Response({'error': 'answer_id is required'}, status=status.HTTP_400_BAD_REQUEST)

	try:
		answer = Post.objects.select_related('user').get(id=answer_id, type=1, parent_id=question.id, delete_flag=False)
	except Post.DoesNotExist:
		return Response({'error': 'Answer not found for this question'}, status=status.HTTP_404_NOT_FOUND)

	membership = TeamUser.objects.filter(team=question.team, user=user).first()
	if not membership:
		return Response({'error': 'You are not a member of this team'}, status=status.HTTP_403_FORBIDDEN)

	current_reputation = membership.reputation if membership.reputation and membership.reputation > 0 else 1
	if current_reputation < (BOUNTY_AMOUNT + 1):
		return Response(
			{'error': f'You need at least {BOUNTY_AMOUNT + 1} reputation to award this bounty.'},
			status=status.HTTP_400_BAD_REQUEST,
		)

	with transaction.atomic():
		bounty = (
			Bounty.objects.select_for_update()
			.filter(post=question, status=Bounty.STATUS_OFFERED)
			.order_by('-start_time')
			.first()
		)
		if not bounty:
			return Response({'error': 'No offered bounty found for this question'}, status=status.HTTP_400_BAD_REQUEST)

		bounty.status = Bounty.STATUS_EARNED
		bounty.awarded_answer = answer
		bounty.end_time = timezone.now()
		bounty.save(update_fields=['status', 'awarded_answer', 'end_time'])

		Post.objects.filter(id=question.id).update(bounty_amount=0)
		question.refresh_from_db(fields=['bounty_amount'])

		apply_reputation_change(
			user=question.user,
			team=question.team,
			triggered_by=user,
			post=question,
			points=-BOUNTY_AMOUNT,
			reason='bounty offered',
		)
		apply_reputation_change(
			user=answer.user,
			team=question.team,
			triggered_by=user,
			post=answer,
			points=BOUNTY_AMOUNT,
			reason='bounty earned',
		)

	return Response(
		{
			'question_id': question.id,
			'bounty_amount': question.bounty_amount,
			'bounty': _serialize_bounty(bounty),
			'awarded_answer_id': answer.id,
		},
		status=status.HTTP_200_OK,
	)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def follow_question(request, question_id):
	user = request.user

	try:
		question = Post.objects.select_related('team').get(id=question_id, type=0)
	except Post.DoesNotExist:
		return Response({'error': 'Question not found'}, status=status.HTTP_404_NOT_FOUND)

	if not TeamUser.objects.filter(team=question.team, user=user).exists():
		return Response({'error': 'You are not a member of this team'}, status=status.HTTP_403_FORBIDDEN)

	PostFollow.objects.get_or_create(post=question, user=user)

	followers_count = PostFollow.objects.filter(post=question).count()

	return Response(
		{
			'question_id': question.id,
			'is_following': True,
			'followers_count': followers_count,
		},
		status=status.HTTP_200_OK,
	)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def unfollow_question(request, question_id):
	user = request.user

	try:
		question = Post.objects.select_related('team').get(id=question_id, type=0)
	except Post.DoesNotExist:
		return Response({'error': 'Question not found'}, status=status.HTTP_404_NOT_FOUND)

	if not TeamUser.objects.filter(team=question.team, user=user).exists():
		return Response({'error': 'You are not a member of this team'}, status=status.HTTP_403_FORBIDDEN)

	PostFollow.objects.filter(post=question, user=user).delete()

	followers_count = PostFollow.objects.filter(post=question).count()

	return Response(
		{
			'question_id': question.id,
			'is_following': False,
			'followers_count': followers_count,
		},
		status=status.HTTP_200_OK,
	)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def add_question_mentions(request, question_id):
	user = request.user

	try:
		question = Post.objects.select_related('team').get(id=question_id, type=0)
	except Post.DoesNotExist:
		return Response({'error': 'Question not found'}, status=status.HTTP_404_NOT_FOUND)

	if not TeamUser.objects.filter(team=question.team, user=user).exists():
		return Response({'error': 'You are not a member of this team'}, status=status.HTTP_403_FORBIDDEN)

	raw_user_ids = request.data.get('user_ids')
	if not isinstance(raw_user_ids, list) or not raw_user_ids:
		return Response({'error': 'user_ids must be a non-empty list'}, status=status.HTTP_400_BAD_REQUEST)

	parsed_user_ids = []
	for value in raw_user_ids:
		try:
			parsed_user_ids.append(int(value))
		except (TypeError, ValueError):
			return Response({'error': 'Each user_id must be an integer'}, status=status.HTTP_400_BAD_REQUEST)

	if user.id in parsed_user_ids:
		return Response({'error': 'You cannot mention yourself'}, status=status.HTTP_400_BAD_REQUEST)

	member_ids = set(
		TeamUser.objects.filter(team=question.team, user_id__in=parsed_user_ids).values_list('user_id', flat=True)
	)
	missing_user_ids = sorted(set(parsed_user_ids) - member_ids)
	if missing_user_ids:
		return Response(
			{'error': 'Some users are not members of this team', 'missing_user_ids': missing_user_ids},
			status=status.HTTP_400_BAD_REQUEST,
		)

	created_count = 0
	for target_user_id in parsed_user_ids:
		mention, created = Notification.objects.get_or_create(
			post=question,
			user_id=target_user_id,
			reason='mentioned_in_question',
			defaults={'triggered_by': user},
		)
		if created:
			created_count += 1
		elif mention.triggered_by_id != user.id:
			mention.triggered_by = user
			mention.save(update_fields=['triggered_by'])

	mentions = (
		Notification.objects.filter(post=question, reason='mentioned_in_question')
		.select_related('user', 'triggered_by')
		.order_by('created_at')
	)

	payload = [
		{
			'id': mention.id,
			'user_id': mention.user_id,
			'user_name': _display_name(question.team_id, mention.user_id),
			'mentioned_by': mention.triggered_by_id,
			'mentioned_by_name': _display_name(question.team_id, mention.triggered_by_id),
			'created_at': mention.created_at,
		}
		for mention in mentions
	]

	return Response(
		{
			'created_count': created_count,
			'mentions': payload,
		},
		status=status.HTTP_200_OK,
	)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def remove_question_mention(request, question_id):
	user = request.user

	try:
		question = Post.objects.select_related('team').get(id=question_id, type=0)
	except Post.DoesNotExist:
		return Response({'error': 'Question not found'}, status=status.HTTP_404_NOT_FOUND)

	if not TeamUser.objects.filter(team=question.team, user=user).exists():
		return Response({'error': 'You are not a member of this team'}, status=status.HTTP_403_FORBIDDEN)

	if question.user_id != user.id:
		return Response({'error': 'Only the question author can remove mentions'}, status=status.HTTP_403_FORBIDDEN)

	target_user_id = request.data.get('user_id')
	try:
		target_user_id = int(target_user_id)
	except (TypeError, ValueError):
		return Response({'error': 'user_id must be an integer'}, status=status.HTTP_400_BAD_REQUEST)

	removed_count, _ = Notification.objects.filter(
		post=question,
		user_id=target_user_id,
		reason='mentioned_in_question',
	).delete()

	mentions = (
		Notification.objects.filter(post=question, reason='mentioned_in_question')
		.select_related('user', 'triggered_by')
		.order_by('created_at')
	)

	payload = [
		{
			'id': mention.id,
			'user_id': mention.user_id,
			'user_name': _display_name(question.team_id, mention.user_id),
			'mentioned_by': mention.triggered_by_id,
			'mentioned_by_name': _display_name(question.team_id, mention.triggered_by_id),
			'created_at': mention.created_at,
		}
		for mention in mentions
	]

	return Response(
		{
			'removed_count': removed_count,
			'mentions': payload,
		},
		status=status.HTTP_200_OK,
	)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def add_bookmark(request):
	user = request.user

	post_id = request.data.get('post_id')
	collection_id = request.data.get('collection_id')

	if bool(post_id) == bool(collection_id):
		return Response({'error': 'Exactly one of post_id or collection_id is required'}, status=status.HTTP_400_BAD_REQUEST)

	if post_id:
		try:
			post = Post.objects.select_related('team').get(id=post_id)
		except Post.DoesNotExist:
			return Response({'error': 'Post not found'}, status=status.HTTP_404_NOT_FOUND)

		if not TeamUser.objects.filter(team=post.team, user=user).exists():
			return Response({'error': 'You are not a member of this team'}, status=status.HTTP_403_FORBIDDEN)

		bookmark, created = Bookmark.objects.get_or_create(
			user=user,
			post=post,
			collection=None,
		)

		if created:
			Post.objects.filter(id=post.id).update(bookmarks_count=F('bookmarks_count') + 1)

		return Response(
			{
				'id': bookmark.id,
				'post_id': bookmark.post_id,
				'collection_id': None,
				'is_bookmarked': True,
			},
			status=status.HTTP_200_OK,
		)

	try:
		collection = Collection.objects.select_related('team').get(id=collection_id)
	except Collection.DoesNotExist:
		return Response({'error': 'Collection not found'}, status=status.HTTP_404_NOT_FOUND)

	if not TeamUser.objects.filter(team=collection.team, user=user).exists():
		return Response({'error': 'You are not a member of this team'}, status=status.HTTP_403_FORBIDDEN)

	bookmark, created = Bookmark.objects.get_or_create(
		user=user,
		post=None,
		collection=collection,
	)

	if created:
		Collection.objects.filter(id=collection.id).update(bookmarks_count=F('bookmarks_count') + 1)

	return Response(
		{
			'id': bookmark.id,
			'post_id': bookmark.post_id,
			'collection_id': bookmark.collection_id,
			'is_bookmarked': True,
		},
		status=status.HTTP_200_OK,
	)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def remove_bookmark(request):
	user = request.user

	post_id = request.data.get('post_id')
	collection_id = request.data.get('collection_id')
	if bool(post_id) == bool(collection_id):
		return Response({'error': 'Exactly one of post_id or collection_id is required'}, status=status.HTTP_400_BAD_REQUEST)

	if post_id:
		deleted_count, _ = Bookmark.objects.filter(user=user, post_id=post_id).delete()
		if deleted_count == 0:
			return Response({'error': 'Bookmark not found'}, status=status.HTTP_404_NOT_FOUND)

		Post.objects.filter(id=post_id).update(
			bookmarks_count=Greatest(Coalesce(F('bookmarks_count'), 0) - deleted_count, 0)
		)

		return Response(
			{
				'post_id': int(post_id),
				'collection_id': None,
				'is_bookmarked': False,
			},
			status=status.HTTP_200_OK,
		)

	deleted_count, _ = Bookmark.objects.filter(user=user, collection_id=collection_id, post__isnull=True).delete()
	if deleted_count == 0:
		return Response({'error': 'Bookmark not found'}, status=status.HTTP_404_NOT_FOUND)

	Collection.objects.filter(id=collection_id).update(
		bookmarks_count=Greatest(Coalesce(F('bookmarks_count'), 0) - deleted_count, 0)
	)

	return Response(
		{
			'post_id': None,
			'collection_id': int(collection_id),
			'is_bookmarked': False,
		},
		status=status.HTTP_200_OK,
	)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_bookmarks(request):
	user = request.user

	team_id = request.query_params.get('team_id')
	if not team_id:
		return Response({'error': 'team_id is required'}, status=status.HTTP_400_BAD_REQUEST)

	if not TeamUser.objects.filter(team_id=team_id, user=user).exists():
		return Response({'error': 'You are not a member of this team'}, status=status.HTTP_403_FORBIDDEN)

	target_user = user
	user_id = request.query_params.get('user_id')
	if user_id:
		try:
			target_user = User.objects.get(id=user_id)
		except User.DoesNotExist:
			return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

		if not TeamUser.objects.filter(team_id=team_id, user=target_user).exists():
			return Response({'error': 'User is not a member of this team'}, status=status.HTTP_404_NOT_FOUND)

	bookmarks = (
		Bookmark.objects.filter(user=target_user)
		.select_related('post__user', 'collection__user')
		.order_by('-id')
	)

	post_ids = [item.post_id for item in bookmarks]
	posts_by_id = {
		post.id: post
		for post in Post.objects.filter(id__in=post_ids).prefetch_related(tag_prefetch('bookmark_tag_posts'))
	}

	data = []
	for item in bookmarks:
		if item.post_id:
			post = posts_by_id.get(item.post_id, item.post)
			if not post or str(post.team_id) != str(team_id):
				continue

			data.append(
				{
					'bookmark_id': item.id,
					'target_type': 'post',
					'post_id': post.id,
					'collection_id': None,
					'delete_flag': post.delete_flag,
					'post_type': post.type,
					'post_type_label': ARTICLE_TYPE_TO_LABEL.get(post.type, 'Question' if post.type == 0 else 'Post'),
					'title': post.title,
					'body': post.body,
					'user_name': _display_name(post.team_id, post.user_id),
					'created_at': post.created_at,
					'views_count': post.views_count,
					'vote_count': post.vote_count,
					'bookmarks_count': post.bookmarks_count,
					'tags': serialize_post_tags(post, 'bookmark_tag_posts'),
					'is_bookmarked': True,
				}
			)
			continue

		collection = item.collection
		if not collection or str(collection.team_id) != str(team_id):
			continue

		data.append(
			{
				'bookmark_id': item.id,
				'target_type': 'collection',
				'post_id': None,
				'collection_id': collection.id,
				'post_type': None,
				'post_type_label': 'Collection',
				'title': collection.title,
				'body': collection.description,
				'user_name': _display_name(collection.team_id, collection.user_id),
				'created_at': collection.created_at,
				'views_count': collection.views_count,
				'vote_count': collection.vote_count,
				'bookmarks_count': collection.bookmarks_count,
				'tags': [],
				'is_bookmarked': True,
			}
		)

	return Response(data, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_followed_posts(request):
	user = request.user

	team_id = request.query_params.get('team_id')
	if not team_id:
		return Response({'error': 'team_id is required'}, status=status.HTTP_400_BAD_REQUEST)

	if not TeamUser.objects.filter(team_id=team_id, user=user).exists():
		return Response({'error': 'You are not a member of this team'}, status=status.HTTP_403_FORBIDDEN)

	target_user = user
	user_id = request.query_params.get('user_id')
	if user_id:
		try:
			target_user = User.objects.get(id=user_id)
		except User.DoesNotExist:
			return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

		if not TeamUser.objects.filter(team_id=team_id, user=target_user).exists():
			return Response({'error': 'User is not a member of this team'}, status=status.HTTP_404_NOT_FOUND)

	follows = (
		PostFollow.objects.filter(user=target_user, post__team_id=team_id, post__type=0)
		.select_related('post__user')
		.order_by('-created_at')
	)

	post_ids = [item.post_id for item in follows]
	posts_by_id = {
		post.id: post
		for post in Post.objects.filter(id__in=post_ids).prefetch_related(tag_prefetch('follow_tag_posts'))
	}

	data = []
	for item in follows:
		post = posts_by_id.get(item.post_id, item.post)
		if not post:
			continue

		data.append(
			{
				'follow_id': item.id,
				'post_id': post.id,
				'title': post.title,
				'body': post.body,
				'delete_flag': post.delete_flag,
				'user_id': post.user_id,
				'user_name': _display_name(post.team_id, post.user_id),
				'created_at': post.created_at,
				'views_count': post.views_count,
				'vote_count': post.vote_count,
				'bookmarks_count': post.bookmarks_count,
				'answer_count': post.answer_count or 0,
				'is_closed': bool(post.closed_reason),
				'tags': serialize_post_tags(post, 'follow_tag_posts'),
			}
		)

	return Response(data, status=status.HTTP_200_OK)
