from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from teams.permissions import ensure_team_membership

from apps.collections.models import Collection

from .models import Post
from .serializers import (
    GlobalTitleSearchItemOutputSerializer,
    QuestionSearchItemOutputSerializer,
)
from .constants import (
    ARTICLE_TYPE_VALUES,
    GLOBAL_SEARCH_PER_TYPE_LIMIT,
    GLOBAL_SEARCH_TOTAL_LIMIT,
    SEARCH_QUESTION_LIMIT,
)


# Handle search questions.
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def search_questions(request):
    user = request.user

    team_id = request.query_params.get('team_id')
    if not team_id:
        return Response({'error': 'team_id is required'}, status=status.HTTP_400_BAD_REQUEST)

    membership_error = ensure_team_membership(team_id=team_id, user=user)
    if membership_error:
        return membership_error

    query = str(request.query_params.get('q', '')).strip()

    questions = Post.objects.filter(team_id=team_id, type=0).select_related('user').order_by('-created_at')
    if query:
        questions = questions.filter(title__icontains=query)

    payload = [
        {
            'id': item.id,
            'title': item.title,
            'user_name': item.user.name,
            'created_at': item.created_at,
            'delete_flag': item.delete_flag,
            'is_closed': bool(item.closed_reason),
            'closed_reason': item.closed_reason,
        }
        for item in questions[:SEARCH_QUESTION_LIMIT]
    ]

    output = QuestionSearchItemOutputSerializer(data=payload, many=True)
    output.is_valid(raise_exception=True)

    return Response(output.data, status=status.HTTP_200_OK)


# Handle search global titles.
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def search_global_titles(request):
    user = request.user

    team_id = request.query_params.get('team_id')
    if not team_id:
        return Response({'error': 'team_id is required'}, status=status.HTTP_400_BAD_REQUEST)

    membership_error = ensure_team_membership(team_id=team_id, user=user)
    if membership_error:
        return membership_error

    query = str(request.query_params.get('q', '')).strip()
    if not query:
        return Response([], status=status.HTTP_200_OK)

    question_posts = (
        Post.objects.filter(team_id=team_id, type=0, delete_flag=False, title__icontains=query)
        .select_related('user')
        .order_by('-created_at')[:GLOBAL_SEARCH_PER_TYPE_LIMIT]
    )
    article_posts = (
        Post.objects.filter(team_id=team_id, type__in=ARTICLE_TYPE_VALUES, delete_flag=False, title__icontains=query)
        .select_related('user')
        .order_by('-created_at')[:GLOBAL_SEARCH_PER_TYPE_LIMIT]
    )
    collections = (
        Collection.objects.filter(team_id=team_id, title__icontains=query)
        .select_related('user')
        .order_by('-created_at')[:GLOBAL_SEARCH_PER_TYPE_LIMIT]
    )

    results = [
        {
            'id': item.id,
            'type': 'question',
            'title': item.title,
            'user_name': item.user.name,
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
                'user_name': item.user.name,
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
                'user_name': item.user.name,
                'created_at': item.created_at,
            }
            for item in collections
        ]
    )

    results.sort(key=lambda item: item.get('created_at') or timezone.now(), reverse=True)

    output = GlobalTitleSearchItemOutputSerializer(data=results[:GLOBAL_SEARCH_TOTAL_LIMIT], many=True)
    output.is_valid(raise_exception=True)

    return Response(output.data, status=status.HTTP_200_OK)


