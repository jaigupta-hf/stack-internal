# Comments App Context

## Purpose
This app handles threaded comments on posts and collections.

It provides:
- Comment creation (root or reply).
- Comment update/delete by author.
- Reply-depth validation.
- Notification side effects for replies and followed questions.

## Main Files
- `models.py`: `Comment`.
- `views.py`: create and update/delete handlers.
- `serializers.py`: validation for create/update and output payload.
- `urls.py`: routes under `/api/comments/*`.

## Data Model
### `Comment`
- Targets exactly one parent entity: either `post` or `collection`.
- Optional `parent_comment` for replies.
- Stores `body`, `vote_count`, timestamps, and author.

## Endpoints
Base path: `/api/comments/`

- `POST /` -> create comment.
  - Body supports:
    - root comment: exactly one of `post_id` or `collection_id`
    - reply: `parent_comment_id`
- `PATCH /{comment_id}/` -> update own comment body.
- `DELETE /{comment_id}/` -> delete own comment.

## Key Function Behavior
- `create_comment`
  - Validates targeting rules.
  - For replies, resolves parent thread and enforces max reply depth of 2 levels.
  - Requires team membership for target team.
  - Emits notifications for reply/comment events.
  - Notifies followers when commenting on a question.
- `comment_detail`
  - Requires membership and ownership checks.
  - PATCH updates body.
  - DELETE removes comment.

## Cross-App Dependencies
- `posts` for post targets and follower graph.
- `collections` for collection targets.
- `teams` for membership checks and display names.
- `notifications` for event side effects.

## Developer Guidance
- Preserve the exactly-one target invariant (post vs collection).
- Keep reply depth enforcement in place unless product rules change.
- Any new side effect should stay explicit in `views.py` for traceability.