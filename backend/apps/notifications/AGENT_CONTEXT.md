# Notifications App Context

## Purpose
This app stores and serves user notification events tied to posts.

It provides:
- Notification feed retrieval.
- Read/unread state updates.
- Bulk mark-as-read for a team.
- Shared API helper for creating notifications from other apps.

## Main Files
- `models.py`: `Notification`.
- `views.py`: list and read-state endpoints.
- `api.py`: `create_notification` helper.
- `serializers.py`: input/output schemas.
- `urls.py`: routes under `/api/notifications/*`.

## Data Model
### `Notification`
Fields:
- `post`, `user`, `triggered_by`
- `reason`
- `created_at`
- `is_read`

## Endpoints
Base path: `/api/notifications/`

- `GET list/` -> list up to 100 notifications for user in a team.
- `POST {notification_id}/read/` -> mark one as read.
- `POST {notification_id}/unread/` -> mark one as unread.
- `POST read-all/` -> mark all unread notifications for team as read.

## Internal Helper API
### `create_notification(post, user, triggered_by, reason)`
Behavior:
- No-op if required objects are missing.
- No-op for self-notifications (`user == triggered_by`).
- Creates a notification row otherwise.

## Cross-App Usage
Used by:
- posts (answers, edits, approvals, mention flows, question state changes)
- comments (comment and reply events)

## Important Notes
- Notification list endpoint also returns team-context trigger display names.
- Team membership is validated before list and mutation operations.

## Developer Guidance
- If adding a new notification reason, ensure downstream UI can render it.
- Keep notification creation centralized through `notifications.api`.
- For new notification list fields, update serializers and consumer expectations together.