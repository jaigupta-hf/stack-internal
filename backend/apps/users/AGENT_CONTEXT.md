# Users App Context

## Purpose
This app owns authentication identity and profile APIs.

It handles:
- Google token verification and app JWT issuance.
- Current user resolution from JWT.
- User profile read/update.
- Team-scoped profile views with activity and tag usage data.

## Main Files
- `models.py`: user identity model.
- `views.py`: auth and profile endpoints.
- `serializers.py`: input/output contracts.
- `utils/auth.py`: JWT generation/verification and DRF auth backend.
- `urls.py`: route mapping for `/api/users/*`.

## Data Model
### `User`
Important fields:
- `id`
- `email` (stored in DB column `mail`)
- `name`, `title`, `about`
- `joined_at`, `last_seen`

## Endpoints
Base path: `/api/users/`

- `POST auth/google/` -> `google_auth`
  - Validates Google credential token.
  - Gets or creates app user.
  - Returns app JWT tokens and user payload.
- `GET auth/me/` -> `get_current_user`
  - Returns authenticated user payload.
- `POST auth/logout/` -> `logout_user`
  - Stateless logout handshake.
- `GET profile/` -> `get_profile`
  - Requires query `team_id`.
  - Optional `user_id` to view another member profile.
  - Returns profile + recent activity + tag usage.
- `PATCH profile/` -> `get_profile`
  - Partial update for `name`, `title`, `about`.

## Internal Logic Notes
- Team access checks in profile GET use shared helpers from `teams.permissions`:
  - `ensure_team_membership`
  - `get_team_membership`
- Profile activity is built from recent posts for the team.
- `can_edit` is true only when target profile is the authenticated user.

## Cross-App Dependencies
- `teams.permissions` for membership gating.
- `posts.models.Post` for profile activity feed.

## JWT/Auth Behavior
In `utils/auth.py`:
- `generate_jwt_token(user_email, user_id)` creates 7-day token.
- `verify_jwt_token(token)` validates/decodes token.
- `JWTAppUserAuthentication` parses Bearer token and resolves `User`.

## Developer Guidance
- Keep JWT payload and auth behavior stable; many endpoints rely on it.
- If profile response changes, also update `ProfileOutputSerializer`.
- Prefer serializer validation over ad hoc request parsing.
- For any new team-scoped profile field, preserve membership checks before data fetch.