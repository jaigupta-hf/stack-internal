# Reputation App Context

## Purpose
This app tracks reputation history and bounty lifecycle data, and exposes reputation history APIs.

It provides:
- Team-scoped reputation history endpoint.
- Core function to apply reputation deltas safely.
- Bounty domain model used by post interaction flows.

## Main Files
- `models.py`: `ReputationHistory`, `Bounty`.
- `views.py`: `ReputationHistoryListView` class-based endpoint.
- `api.py`: `apply_reputation_change` service function.
- `serializers.py`: query/output schema.
- `urls.py`: route under `/api/reputation/*`.

## Data Model
- `ReputationHistory`: immutable ledger-like entries for each reputation change.
- `Bounty`: question bounty state with offered/earned lifecycle.

## Endpoint
Base path: `/api/reputation/`

- `GET history/` -> grouped reputation entries by date.
  - Query: `team_id` required, `user_id` optional, pagination supported.
  - Access control: `IsAuthenticated` + `IsTeamMember`.

## Core Service Function
### `apply_reputation_change(user, team, triggered_by, post, points, reason)`
Behavior:
- Ignores zero-point operations.
- Ignores unsupported reasons (guarded by `ALLOWED_REASONS`).
- Resolves team membership and updates `TeamUser.reputation`.
- Enforces minimum reputation floor of 1.
- Writes `ReputationHistory` only when effective points are non-zero.

## Allowed Reason Codes
In `api.py`, `ALLOWED_REASONS` currently includes:
- `upvote`, `unupvote`
- `downvote`, `undownvote`
- `accept`, `unaccept`
- `downvoted`, `undownvoted`
- `bounty offered`, `bounty earned`

## Cross-App Dependencies
- Used by posts and votes flows for all reputation side effects.
- Depends on `teams` membership state for reputation storage (`TeamUser.reputation`).

## Developer Guidance
- Add new reputation reason strings to `ALLOWED_REASONS` before emitting them.
- Keep reputation floor behavior consistent across all call sites.
- For new reputation-affecting features, route through `apply_reputation_change`.