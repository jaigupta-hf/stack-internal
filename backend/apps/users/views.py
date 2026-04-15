import os

from django.utils import timezone
from google.auth.transport import requests
from google.oauth2 import id_token
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from teams.permissions import IsTeamMember

from .models import User
from .services import UserService, UserServiceError
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
        user = UserService.update_profile(user=user, updates=updates)

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

        raw_team_id = request.query_params.get('team_id')
        if not raw_team_id:
            return Response({'error': 'team_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            team_id = int(raw_team_id)
        except (TypeError, ValueError):
            return Response({'error': 'team_id must be an integer'}, status=status.HTTP_400_BAD_REQUEST)

        user_id = request.query_params.get('user_id')
        target_user_id = None
        if user_id not in (None, ''):
            try:
                target_user_id = int(user_id)
            except (TypeError, ValueError):
                return Response({'error': 'user_id must be an integer'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            payload = UserService.build_profile_payload(
                requester=user,
                team_id=team_id,
                target_user_id=target_user_id,
            )
        except UserServiceError as error:
            return Response({'error': str(error)}, status=error.status_code)

        output_serializer = ProfileOutputSerializer(
            data=payload
        )
        output_serializer.is_valid(raise_exception=True)
        return Response(output_serializer.data, status=status.HTTP_200_OK)
