# Backend Overview

This backend is a Django REST API for Stack Internal.
At a high level, it provides:

- Google-based login and JWT session handling
- Team creation and team listing APIs
- Team membership checks for protected resources

## Architecture At A Glance

- config/
  - Global Django settings and root URL routing
- apps/users/
  - Authentication and current-user endpoints
  - JWT creation and request authentication
- apps/teams/
  - Team CRUD-style endpoints used by the frontend team workspace
  - Team membership and member-list logic
- apps/pagination.py
  - Shared pagination helpers for list endpoints

## API Surface (High Level)

- /api/users/
  - Login via Google token
  - Resolve current authenticated user
  - Logout handshake
- /api/teams/
  - List teams for current user
  - Create team
  - Get team by slug
  - List team members with pagination

## Authentication Model

- Client sends Google credential to users auth endpoint.
- Backend verifies credential and issues app JWT token.
- Protected endpoints use Bearer token auth through DRF authentication class.
- Team endpoints require authenticated user and membership checks where needed.

## Data Model Notes

- Existing shared PostgreSQL tables are used.
- users app maps email to DB column mail.
- teams app uses teams and team_users tables.

## Running Locally

```bash
cd backend
source venv/bin/activate
python manage.py check
python manage.py runserver 3000
```

Use backend/.env for database, secret key, and Google OAuth settings.

## Developer Guidance

- Keep endpoint response shapes stable when possible because frontend services depend on them.
- Treat authentication and membership checks as cross-cutting concerns for new endpoints.
- If adding list endpoints, reuse shared pagination helpers for consistency.
