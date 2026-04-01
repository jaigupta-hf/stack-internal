import jwt
from datetime import datetime, timedelta
from django.conf import settings
from rest_framework.authentication import BaseAuthentication, get_authorization_header
from rest_framework.exceptions import AuthenticationFailed
from ..models import User


def generate_jwt_token(user_email, user_id):
    payload = {
        'user_id': user_id,
        'email': user_email,
        'exp': datetime.utcnow() + timedelta(days=7),
        'iat': datetime.utcnow(),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm='HS256')


def verify_jwt_token(token):
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None


class JWTAppUserAuthentication(BaseAuthentication):
    keyword = 'Bearer'

    def authenticate(self, request):
        auth_header = get_authorization_header(request).decode('utf-8')
        if not auth_header:
            return None

        parts = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != 'bearer':
            raise AuthenticationFailed('Invalid authorization header format.')

        payload = verify_jwt_token(parts[1])
        if not payload:
            raise AuthenticationFailed('Invalid or expired token.')

        try:
            user = User.objects.get(id=payload.get('user_id'), email=payload.get('email'))
        except User.DoesNotExist as exc:
            raise AuthenticationFailed('User not found.') from exc

        return (user, payload)

    def authenticate_header(self, request):
        return self.keyword
