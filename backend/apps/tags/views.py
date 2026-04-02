from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.db import transaction
from django.db.models import F
from django.db.models import IntegerField, Value
from django.db.models.functions import Coalesce, Greatest
from teams.models import TeamUser
from .models import Tag, TagUser


@api_view(['GET'])
@permission_classes([AllowAny])
def search_tags(request):
	query = (request.query_params.get('q') or '').strip()
	if not query:
		return Response([], status=status.HTTP_200_OK)

	tags = (
		Tag.objects.filter(name__icontains=query)
		.annotate(
			question_count_safe=Coalesce('question_count', Value(0), output_field=IntegerField()),
			article_count_safe=Coalesce('article_count', Value(0), output_field=IntegerField()),
		)
		.annotate(total_post_count=F('question_count_safe') + F('article_count_safe'))
		.order_by('-watch_count', '-total_post_count', 'name')[:8]
	)

	data = [
		{
			'id': tag.id,
			'name': tag.name,
			'question_count': tag.question_count,
			'article_count': tag.article_count,
			'total_post_count': tag.total_post_count,
			'watch_count': tag.watch_count,
		}
		for tag in tags
	]
	return Response(data, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_team_tags(request):
	user = request.user

	team_id = request.query_params.get('team_id')
	if not team_id:
		return Response({'error': 'team_id is required'}, status=status.HTTP_400_BAD_REQUEST)

	if not TeamUser.objects.filter(team_id=team_id, user=user).exists():
		return Response({'error': 'You are not a member of this team'}, status=status.HTTP_403_FORBIDDEN)

	tags = (
		Tag.objects.filter(
			tag_posts__post__team_id=team_id,
			tag_posts__post__type__in=(0, 20, 21, 22, 23),
			tag_posts__post__delete_flag=False,
		)
		.distinct()
		.annotate(
			question_count_safe=Coalesce('question_count', Value(0), output_field=IntegerField()),
			article_count_safe=Coalesce('article_count', Value(0), output_field=IntegerField()),
		)
		.annotate(total_post_count=F('question_count_safe') + F('article_count_safe'))
		.order_by('-total_post_count', '-watch_count', 'name')
	)

	data = [
		{
			'id': tag.id,
			'name': tag.name,
			'about': tag.about,
			'question_count': tag.question_count,
			'article_count': tag.article_count,
			'total_post_count': tag.total_post_count,
			'watch_count': tag.watch_count,
			'created_at': tag.created_at,
		}
		for tag in tags
	]

	return Response(data, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_tag_preferences(request):
	user = request.user

	team_id = request.query_params.get('team_id')
	if not team_id:
		return Response({'error': 'team_id is required'}, status=status.HTTP_400_BAD_REQUEST)

	if not TeamUser.objects.filter(team_id=team_id, user=user).exists():
		return Response({'error': 'You are not a member of this team'}, status=status.HTTP_403_FORBIDDEN)

	tag_users = (
		TagUser.objects.filter(
			user=user,
			tag__tag_posts__post__team_id=team_id,
			tag__tag_posts__post__type__in=(0, 20, 21, 22, 23),
			tag__tag_posts__post__delete_flag=False,
		)
		.select_related('tag')
		.distinct()
		.order_by('-count', 'tag__name')
	)

	data = [
		{
			'tag_id': item.tag_id,
			'tag_name': item.tag.name,
			'count': item.count,
			'is_watching': item.is_watching,
			'is_ignored': item.is_ignored,
		}
		for item in tag_users
	]

	return Response(data, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_tag_preference(request):
	user = request.user

	team_id = request.data.get('team_id')
	tag_id = request.data.get('tag_id')
	field = str(request.data.get('field', '')).strip()
	value = request.data.get('value')

	if not team_id or not tag_id:
		return Response({'error': 'team_id and tag_id are required'}, status=status.HTTP_400_BAD_REQUEST)

	if field not in ('is_watching', 'is_ignored'):
		return Response({'error': 'field must be is_watching or is_ignored'}, status=status.HTTP_400_BAD_REQUEST)

	if value not in (True, False):
		return Response({'error': 'value must be true or false'}, status=status.HTTP_400_BAD_REQUEST)

	if not TeamUser.objects.filter(team_id=team_id, user=user).exists():
		return Response({'error': 'You are not a member of this team'}, status=status.HTTP_403_FORBIDDEN)

	tag = Tag.objects.filter(
		id=tag_id,
		tag_posts__post__team_id=team_id,
		tag_posts__post__type__in=(0, 20, 21, 22, 23),
		tag_posts__post__delete_flag=False,
	).distinct().first()
	if not tag:
		return Response({'error': 'Tag not found in this team'}, status=status.HTTP_404_NOT_FOUND)

	with transaction.atomic():
		tag_user, _ = TagUser.objects.select_for_update().get_or_create(
			user=user,
			tag=tag,
			defaults={'count': 1},
		)

		was_watching = bool(tag_user.is_watching)

		if field == 'is_watching':
			tag_user.is_watching = value
			if value:
				tag_user.is_ignored = False
		else:
			tag_user.is_ignored = value
			if value:
				tag_user.is_watching = False

		is_watching_now = bool(tag_user.is_watching)
		tag_user.save(update_fields=['is_watching', 'is_ignored'])

		if not was_watching and is_watching_now:
			Tag.objects.filter(id=tag.id).update(watch_count=Coalesce(F('watch_count'), 0) + 1)
		elif was_watching and not is_watching_now:
			Tag.objects.filter(id=tag.id).update(
				watch_count=Greatest(Coalesce(F('watch_count'), 0) - 1, 0)
			)

	return Response(
		{
			'tag_id': tag.id,
			'tag_name': tag.name,
			'count': tag_user.count,
			'is_watching': tag_user.is_watching,
			'is_ignored': tag_user.is_ignored,
		},
		status=status.HTTP_200_OK,
	)
