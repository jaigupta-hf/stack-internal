from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.db import transaction
from django.db.models import F
from django.db.models import IntegerField, Value
from django.db.models.functions import Coalesce, Greatest
from teams.permissions import ensure_team_membership
from .models import Tag, TagUser
from .serializers import (
	TagPreferenceOutputSerializer,
	TagSearchItemOutputSerializer,
	TeamIdQuerySerializer,
	TeamTagOutputSerializer,
	UpdateTagPreferenceInputSerializer,
)


# Search tags by name fragment and return top suggestions ranked by popularity and usage.
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
	output = TagSearchItemOutputSerializer(data=data, many=True)
	output.is_valid(raise_exception=True)
	return Response(output.data, status=status.HTTP_200_OK)


# List all tags used by active posts in a team with aggregate usage and watch metadata.
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_team_tags(request):
	user = request.user

	raw_team_id = request.query_params.get('team_id')
	if not raw_team_id:
		return Response({'error': 'team_id is required'}, status=status.HTTP_400_BAD_REQUEST)

	team_id_serializer = TeamIdQuerySerializer(data={'team_id': raw_team_id})
	if not team_id_serializer.is_valid():
		return Response(team_id_serializer.errors, status=status.HTTP_400_BAD_REQUEST)
	team_id = team_id_serializer.validated_data['team_id']

	membership_error = ensure_team_membership(team_id=team_id, user=user)
	if membership_error:
		return membership_error

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

	output = TeamTagOutputSerializer(data=data, many=True)
	output.is_valid(raise_exception=True)
	return Response(output.data, status=status.HTTP_200_OK)


# Return the current user's tag preference records (watch/ignore) scoped to one team.
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_tag_preferences(request):
	user = request.user

	raw_team_id = request.query_params.get('team_id')
	if not raw_team_id:
		return Response({'error': 'team_id is required'}, status=status.HTTP_400_BAD_REQUEST)

	team_id_serializer = TeamIdQuerySerializer(data={'team_id': raw_team_id})
	if not team_id_serializer.is_valid():
		return Response(team_id_serializer.errors, status=status.HTTP_400_BAD_REQUEST)
	team_id = team_id_serializer.validated_data['team_id']

	membership_error = ensure_team_membership(team_id=team_id, user=user)
	if membership_error:
		return membership_error

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

	output = TagPreferenceOutputSerializer(data=data, many=True)
	output.is_valid(raise_exception=True)
	return Response(output.data, status=status.HTTP_200_OK)


# Update one tag preference for the current user and keep tag watch_count in sync atomically.
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_tag_preference(request):
	user = request.user

	team_id = request.data.get('team_id')
	tag_id = request.data.get('tag_id')

	if not team_id or not tag_id:
		return Response({'error': 'team_id and tag_id are required'}, status=status.HTTP_400_BAD_REQUEST)

	input_serializer = UpdateTagPreferenceInputSerializer(data=request.data)
	if not input_serializer.is_valid():
		return Response(input_serializer.errors, status=status.HTTP_400_BAD_REQUEST)

	validated = input_serializer.validated_data
	team_id = validated['team_id']
	tag_id = validated['tag_id']
	field = validated['field']
	value = validated['value']

	membership_error = ensure_team_membership(team_id=team_id, user=user)
	if membership_error:
		return membership_error

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

	output = TagPreferenceOutputSerializer(
		data={
			'tag_id': tag.id,
			'tag_name': tag.name,
			'count': tag_user.count,
			'is_watching': tag_user.is_watching,
			'is_ignored': tag_user.is_ignored,
		}
	)
	output.is_valid(raise_exception=True)

	return Response(output.data, status=status.HTTP_200_OK)
