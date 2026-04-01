# Users App Context For AI Agents

This file explains the users app behavior and constraints so automated changes do not break auth flows.

## Scope

The users app currently owns:

- Google OAuth credential verification
- App JWT issuance and verification
- Current user lookup from Bearer token
- Logout endpoint contract used by frontend

## Route Contracts

Mounted base path: /api/users/

- POST auth/google/
  - Request: { "token": "<google_credential>" }
  - Response: { "user": {...}, "tokens": {"access": "...", "refresh": "..."}, "message": "Login successful" }
- GET auth/me/
  - Requires Authorization: Bearer <access_token>
  - Response: serialized user object
- POST auth/logout/
  - Response: { "message": "Logout successful" }

Do not change these response shapes without updating frontend services and tests.

## Data Model Constraints

- User model maps to existing DB table users.
- email field maps to DB column mail via db_column='mail'.
- Existing shared DB may be used by other app versions.

Do not add destructive schema changes unless explicitly requested.

## Auth Constraints

- JWT payload includes: user_id, email, exp, iat.
- Token expiry is currently 7 days.
- DRF auth class: users.utils.auth.JWTAppUserAuthentication.

If auth behavior changes, update frontend token handling in src/services/config.js and src/services/login-api.js.

## Import and App Path Notes

- manage.py appends apps/ to PYTHONPATH.
- App is registered as users in INSTALLED_APPS.
- Use imports consistent with this layout.

## Safe Change Checklist

Before submitting users app changes:

1. Run python manage.py check.
2. Verify /api/users/auth/google/ with invalid payload returns 400.
3. Verify /api/users/auth/me/ returns 401 without token.
4. Verify frontend still logs in and restores session.
