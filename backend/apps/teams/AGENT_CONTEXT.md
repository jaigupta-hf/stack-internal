# Teams App Context

## Purpose
This app defines team boundaries, team membership, and role-based access control.

It provides:
- Team create/list/lookup/join APIs.
- Team member listing and role management.
- Shared permission helpers reused across backend apps.

## Main Files
- `models.py`: `Team`, `TeamUser`.
- `views.py`: team and membership endpoints.
- `permissions.py`: reusable membership/admin guard helpers.
- `utils.py`: helper to resolve member display names.
- `serializers.py`: request/response contracts.
- `urls.py`: routes under `/api/teams/*`.

## Data Model
### `Team`
- Team metadata (`name`, `url_endpoint`).

### `TeamUser`
- Membership join table between user and team.
- Role and profile attributes inside team context:
  - `is_admin`, `reputation`, `title`, `about`, `impact`.

## Endpoints
Base path: `/api/teams/`

- `GET /` -> list caller teams.
- `POST /` -> create team and auto-create admin membership.
- `GET /by-slug/{url_endpoint}/` -> team metadata + caller membership flags.
- `POST /{team_id}/join/` -> join team or return already-member state.
- `GET /{team_id}/users/` -> paginated member list.
- `POST /{team_id}/users/{user_id}/make-admin/` -> promote user.
- `POST /{team_id}/users/{user_id}/make-member/` -> demote admin.
- `POST /{team_id}/users/{user_id}/remove/` -> remove user from team.

## Permission Helper API
In `permissions.py`:
- `ensure_team_membership(...)`
- `get_team_membership(...)`
- `ensure_team_membership_and_get(...)`
- `ensure_team_admin(membership, error_message=...)`

These helpers are cross-cutting and imported by many apps.

## Important Invariants
- Team must always keep at least one admin.
- Acting user cannot remove self from team via remove endpoint.
- Membership uniqueness is enforced by DB constraint.

## Cross-App Dependencies
This app is a dependency for most backend apps via:
- Membership authorization.
- Member name lookups (`get_team_member_name`).
- Team-scoped reputation state (stored in `TeamUser`).

## Developer Guidance
- Prefer centralized helpers in `permissions.py` over manual TeamUser checks.
- Keep error messages stable where frontend depends on exact strings.
- If adding role types or new auth rules, update helpers first, then callsites.