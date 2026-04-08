import os

from django.utils import timezone
from google.auth.transport import requests
from google.oauth2 import id_token
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from posts.constants import ARTICLE_TYPE_VALUES, POST_TYPE_TO_KEY, POST_TYPE_TO_LABEL
from posts.models import Post
from teams.permissions import IsTeamMember, get_team_membership

from .models import User
from .serializers import (
    GoogleAuthSerializer,
    ProfileOutputSerializer,
    ProfileUpdateOutputSerializer,
    ProfileUpdateSerializer,
    UserSerializer,
)
from .utils.auth import generate_jwt_token


class GoogleAuthView(APIView):
    """Authenticate with Google token exchange and return local JWT credentials."""

    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = GoogleAuthSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        token = serializer.validated_data['token']

        try:
            client_id = os.environ.get('GOOGLE_OAUTH_CLIENT_ID')
            idinfo = id_token.verify_oauth2_token(token, requests.Request(), client_id)

            email = idinfo.get('email')
            name = idinfo.get('name')

            user, _ = User.objects.get_or_create(
                email=email,
                defaults={'name': name or email.split('@')[0]},
            )

            user.last_seen = timezone.now()
            user.save(update_fields=['last_seen'])

            jwt_token = generate_jwt_token(user.email, user.id)

            user_serializer = UserSerializer(user)
            return Response(
                {
                    'user': user_serializer.data,
                    'tokens': {
                        'access': jwt_token,
                        'refresh': jwt_token,
                    },
                    'message': 'Login successful',
                },
                status=status.HTTP_200_OK,
            )

        except ValueError as exc:
            return Response(
                {'error': f'Invalid token: {str(exc)}'},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        except Exception as exc:
            return Response(
                {'error': f'Authentication failed: {str(exc)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class CurrentUserView(APIView):
    """Return authenticated user payload and refresh last_seen."""

    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        user = request.user
        user.last_seen = timezone.now()
        user.save(update_fields=['last_seen'])

        serializer = UserSerializer(user)
        return Response(serializer.data, status=status.HTTP_200_OK)


class LogoutView(APIView):
    """Stateless logout acknowledgment for client-side token cleanup."""

    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        return Response({'message': 'Logout successful'}, status=status.HTTP_200_OK)


class ProfileView(APIView):
    """Read or partially update a team-scoped user profile."""

    permission_classes = [IsAuthenticated, IsTeamMember]

    def get_team_id_for_permission(self, request):
        if request.method.upper() != 'GET':
            return None
        return request.query_params.get('team_id')

    def patch(self, request, *args, **kwargs):
        user = request.user

        update_serializer = ProfileUpdateSerializer(data=request.data, partial=True)
        if not update_serializer.is_valid():
            return Response(update_serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        updates = update_serializer.validated_data

        for field_name, value in updates.items():
            setattr(user, field_name, value)

        if updates:
            user.last_seen = timezone.now()
            user.save(update_fields=[*updates.keys(), 'last_seen'])

        output_serializer = ProfileUpdateOutputSerializer(
            data={
                'id': user.id,
                'name': user.name,
                'title': user.title,
                'about': user.about,
                'last_seen': user.last_seen,
            }
        )
        output_serializer.is_valid(raise_exception=True)
        return Response(output_serializer.data, status=status.HTTP_200_OK)

    def get(self, request, *args, **kwargs):
        user = request.user

        team_id = request.query_params.get('team_id')
        if not team_id:
            return Response({'error': 'team_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        target_user = user
        user_id = request.query_params.get('user_id')
        if user_id:
            try:
                target_user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        membership = get_team_membership(team_id=team_id, user=target_user, select_related_team=True)
        if membership is None:
            return Response({'error': 'User is not a member of this team'}, status=status.HTTP_404_NOT_FOUND)

        user.last_seen = timezone.now()
        user.save(update_fields=['last_seen'])

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

        can_edit = target_user.id == user.id
        tag_usages = []
        for tag_user in target_user.tag_users.select_related('tag').filter(count__gt=0).order_by('-count', 'tag__name'):
            item = {
                'tag_id': tag_user.tag_id,
                'tag_name': tag_user.tag.name,
                'count': tag_user.count,
            }
            if can_edit:
                item['is_watching'] = tag_user.is_watching
                item['is_ignored'] = tag_user.is_ignored
            tag_usages.append(item)

        output_serializer = ProfileOutputSerializer(
            data={
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
        )
        output_serializer.is_valid(raise_exception=True)
        return Response(output_serializer.data, status=status.HTTP_200_OK)
