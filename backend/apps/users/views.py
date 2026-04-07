import os
from google.oauth2 import id_token
from google.auth.transport import requests
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.utils import timezone
from .models import User
from .serializers import (
    GoogleAuthSerializer,
    ProfileOutputSerializer,
    ProfileUpdateOutputSerializer,
    ProfileUpdateSerializer,
    UserSerializer,
)
from .utils.auth import generate_jwt_token
from teams.permissions import ensure_team_membership, get_team_membership
from posts.models import Post
from posts.constants import ARTICLE_TYPE_VALUES, POST_TYPE_TO_KEY, POST_TYPE_TO_LABEL


@api_view(['POST'])
@permission_classes([AllowAny])
def google_auth(request):
    """
    Authenticate user with Google OAuth token and return JWT token
    """
    serializer = GoogleAuthSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    token = serializer.validated_data['token']
    
    try:
        # Verify the token with Google
        client_id = os.environ.get('GOOGLE_OAUTH_CLIENT_ID')
        idinfo = id_token.verify_oauth2_token(token, requests.Request(), client_id)
        
        email = idinfo.get('email')
        name = idinfo.get('name')
        
        # Get or create app user
        user, created = User.objects.get_or_create(
            email=email,
            defaults={'name': name or email.split('@')[0]}
        )
        
        user.last_seen = timezone.now()
        user.save(update_fields=['last_seen'])
        
        # Generate JWT token for this app user
        jwt_token = generate_jwt_token(user.email, user.id)
        
        # Return user data and token
        user_serializer = UserSerializer(user)
        return Response({
            'user': user_serializer.data,
            'tokens': {
                'access': jwt_token,
                'refresh': jwt_token
            },
            'message': 'Login successful'
        }, status=status.HTTP_200_OK)
        
    except ValueError as e:
        return Response(
            {'error': f'Invalid token: {str(e)}'},
            status=status.HTTP_401_UNAUTHORIZED
        )
    except Exception as e:
        return Response(
            {'error': f'Authentication failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_current_user(request):
    """
    Get current authenticated user from JWT token
    """
    user = request.user

    user.last_seen = timezone.now()
    user.save(update_fields=['last_seen'])

    serializer = UserSerializer(user)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([AllowAny])
def logout_user(request):
    """
    Logout the current user.
    With JWT, logout is handled on the client by removing the token.
    """
    return Response({'message': 'Logout successful'}, status=status.HTTP_200_OK)


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def get_profile(request):
    """
    Get authenticated user's profile and top posts for a team.
    """
    user = request.user

    if request.method == 'PATCH':
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

    team_id = request.query_params.get('team_id')
    if not team_id:
        return Response({'error': 'team_id is required'}, status=status.HTTP_400_BAD_REQUEST)

    membership_error = ensure_team_membership(team_id=team_id, user=user)
    if membership_error:
        return membership_error

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
