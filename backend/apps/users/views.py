import os
from google.oauth2 import id_token
from google.auth.transport import requests
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.utils import timezone
from .models import User
from .serializers import UserSerializer, GoogleAuthSerializer
from .utils.auth import generate_jwt_token


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
