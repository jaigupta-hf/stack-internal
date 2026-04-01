# Backend Developer Guide

This backend is a Django + Django REST Framework API for Stack Internal.
Current scope is authentication and user session handling with Google OAuth token verification and app-level JWT tokens.

## Tech Stack

- Django 5
- Django REST Framework
- PostgreSQL
- google-auth
- PyJWT

## Project Structure

backend/
- config/                      Django project settings and root urls
- apps/
  - users/                     Auth + user profile endpoints
    - models.py                User model mapped to existing users table
    - views.py                 Google auth, current user, logout
    - serializers.py           Request/response serializers
    - urls.py                  /api/users/auth/* routes
    - utils/auth.py            JWT encode/decode + DRF auth class
- manage.py                    Adds apps/ to PYTHONPATH and runs Django commands
- requirements.txt

## Local Setup

1. Create and activate virtual environment.
2. Install dependencies.
3. Configure environment variables in backend/.env.
4. Run Django checks and start the server.

Example commands:

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage.py check
python manage.py runserver 3000
```

## Environment Variables

Set these in backend/.env:

- SECRET_KEY
- DB_NAME
- DB_USER
- DB_PASSWORD
- DB_HOST
- DB_PORT
- GOOGLE_OAUTH_CLIENT_ID

## API Endpoints

All routes are mounted under /api/users/.

- POST auth/google/  Verify Google credential and issue app JWT.
- GET auth/me/       Return authenticated user from Bearer token.
- POST auth/logout/  Client-side logout handshake.

## Authentication Flow

1. Frontend sends Google credential token to POST /api/users/auth/google/.
2. Backend verifies token using GOOGLE_OAUTH_CLIENT_ID.
3. Backend gets or creates a row in users table.
4. Backend returns user + tokens.access/tokens.refresh.
5. Frontend stores token and uses Bearer auth for later requests.

## Important Notes

- manage.py appends apps/ to PYTHONPATH, so app imports use users.*.
- users model uses db_table = users and maps email to column mail.
- Avoid schema changes to existing shared DB tables unless explicitly approved.

## Quick Troubleshooting

- Module import errors for users: confirm manage.py is used to run commands.
- Google auth failures: confirm GOOGLE_OAUTH_CLIENT_ID matches frontend client id.
- 401 from auth/me: ensure Authorization header is Bearer <token>.
