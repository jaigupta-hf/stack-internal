# Votes App Context

## Purpose
This app handles voting operations for posts and comments and emits vote-domain events for post-vote reputation side effects.

It provides:
- Submit vote (`+1` or `-1`).
- Remove existing vote.
- Target resolution and validation for post/comment votes.

## Main Files
- `models.py`: `Vote` model and constraints.
- `views.py`: submit/remove vote handlers and helper functions.
- `serializers.py`: request/response schemas.
- `urls.py`: routes under `/api/votes/*`.

## Data Model
### `Vote`
- Supports exactly one target among `post`, `comment`, `collection` (DB-enforced).
- Vote value constrained to `-1` or `1`.
- Uniqueness constraints prevent duplicate votes by same user on same target.

## Endpoints
Base path: `/api/votes/`

- `POST /` -> submit/update vote.
  - Body: exactly one of `post_id` or `comment_id`, plus `vote` (`-1` or `1`).
- `POST /remove/` -> remove vote.
  - Body: exactly one of `post_id` or `comment_id`.

## Key Internal Functions
- `_resolve_target(post_id, comment_id)`
  - Resolves target entity and team.
  - Validates exactly-one target rule.
  - Prevents voting on answer when parent question is deleted.
- `_emit_post_vote_reputation_event(...)`
  - Emits a post-vote transition event for question/answer votes only.
  - Defers reputation side effects to receivers after transaction commit.
- `emit_vote_event(...)` in `domain_events.py`
  - Uses `transaction.on_commit(...)` so receivers run only after successful writes.

## Important Behaviors
- Membership in target team is required before voting.
- Votes are processed in transactions.
- Vote counts are updated incrementally on `Post` or `Comment`.
- Reputation changes are decoupled from this app and handled by reputation receivers.

## Cross-App Dependencies
- `posts` and `comments` for vote targets.
- `teams` for access checks.
- `reputation` consumes vote events and applies point side effects.

## Developer Guidance
- Keep target resolution logic centralized in `_resolve_target`.
- Preserve transactional update flow to avoid count drift.
- If enabling collection voting through this app in future, update serializers and routing explicitly.