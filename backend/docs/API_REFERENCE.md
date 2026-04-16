# Backend API Reference

This document covers the HTTP API exposed by the Django backend.

Related: frontend integration mapping and pagination usage is documented in `docs/FRONTEND_BACKEND_INTEGRATION.md`.

## Base URL

- Local: `http://localhost:8000`
- API root: `http://localhost:8000/api`

## Authentication

- Auth is token-based using the custom DRF authentication class `users.utils.auth.JWTAppUserAuthentication`.
- Send bearer token on protected endpoints:

```http
Authorization: Bearer <access_token>
```

- Public endpoints:
  - `POST /api/users/auth/google/`
  - `POST /api/users/auth/logout/`
  - `GET /api/tags/search/`

## Common Conventions

- Most business endpoints are team-scoped and require `team_id` (query or body).
- Standard list pagination (where applicable):
  - Query params: `page`, `page_size`
  - Response includes `pagination` with `page`, `page_size`, `total_items`, `total_pages`, `has_next`, `has_previous`
- Error format typically:

```json
{ "error": "human-readable message" }
```

## Architecture Flow (Posts Example)

The backend follows a layered pattern for post-related APIs:

1. API layer (`apps/posts/api/*`) accepts HTTP requests, validates input with serializers, checks permissions, and returns response payloads.
2. Service layer (`apps/posts/services/*`) executes core business logic and model updates inside transactions.
3. Domain events (`apps/posts/domain_events.py`) are emitted by posts write flows using `emit_post_event(...)`.
4. Receivers in other apps handle side effects independently:
  - `apps/notifications/receivers.py` creates notification rows.
  - `apps/reputation/receivers.py` applies reputation deltas.

Notes:
- Events are emitted with `transaction.on_commit` semantics to avoid side effects from rolled-back transactions.
- Mention add/remove flows are explicit notification-domain actions and may still call notifications directly.

## Users API

| Endpoint | Method | Auth | Purpose | Key Inputs |
|---|---|---|---|---|
| `/api/users/auth/google/` | `POST` | Public | Google token exchange + app JWT issue | Body: `token` |
| `/api/users/auth/me/` | `GET` | Required | Return current authenticated user | None |
| `/api/users/auth/logout/` | `POST` | Public | Logout handshake (client drops token) | None |
| `/api/users/profile/` | `GET` | Required | Team-scoped profile with activity + tag usage | Query: `team_id` (required), `user_id` (optional) |
| `/api/users/profile/` | `PATCH` | Required | Update own profile | Body: `name?`, `title?`, `about?` |

## Teams API

| Endpoint | Method | Auth | Purpose | Key Inputs |
|---|---|---|---|---|
| `/api/teams/` | `GET` | Required | List teams where caller is a member | None |
| `/api/teams/` | `POST` | Required | Create team (creator becomes admin) | Body: `name`, `url_endpoint` |
| `/api/teams/by-slug/{url_endpoint}/` | `GET` | Required | Resolve team by slug with caller membership flags | Path: `url_endpoint` |
| `/api/teams/{team_id}/join/` | `POST` | Required | Join a team | Path: `team_id` |
| `/api/teams/{team_id}/users/` | `GET` | Required | List team members | Path: `team_id`, Query: `page?`, `page_size?` |
| `/api/teams/{team_id}/users/{user_id}/make-admin/` | `POST` | Required | Promote member to admin | Path: `team_id`, `user_id` |
| `/api/teams/{team_id}/users/{user_id}/make-member/` | `POST` | Required | Demote admin to member | Path: `team_id`, `user_id` |
| `/api/teams/{team_id}/users/{user_id}/remove/` | `POST` | Required | Remove user from team | Path: `team_id`, `user_id` |

## Posts API

### Create and Edit

| Endpoint | Method | Auth | Purpose | Key Inputs |
|---|---|---|---|---|
| `/api/posts/questions/` | `POST` | Required | Create question | Body: `team_id`, `title`, `body`, `tags` (1-5) |
| `/api/posts/articles/` | `POST` | Required | Create article | Body: `team_id`, `title`, `body`, `type` (`20/21/22/23`), `tags` (1-5) |
| `/api/posts/questions/{question_id}/answers/` | `POST` | Required | Create answer | Path: `question_id`, Body: `body` |
| `/api/posts/answers/{answer_id}/` | `PATCH` | Required | Update own answer body (author-only) | Path: `answer_id`, Body: `body` |
| `/api/posts/answers/{answer_id}/delete/` | `POST` | Required | Soft-delete own answer (author-only) | Path: `answer_id` |
| `/api/posts/answers/{answer_id}/undelete/` | `POST` | Required | Restore own deleted answer (author-only) | Path: `answer_id` |
| `/api/posts/questions/{question_id}/approve-answer/` | `PATCH` | Required | Approve or clear approved answer | Path: `question_id`, Body: `answer_id` (nullable) |

### Read and Search

| Endpoint | Method | Auth | Purpose | Key Inputs |
|---|---|---|---|---|
| `/api/posts/questions/list/` | `GET` | Required | Paginated question feed for team | Query: `team_id`, `page?`, `page_size?` |
| `/api/posts/questions/search/` | `GET` | Required | Lightweight question search | Query: `team_id`, `q?` |
| `/api/posts/search/global/` | `GET` | Required | Global title search (questions/articles/collections) | Query: `team_id`, `q` |
| `/api/posts/articles/list/` | `GET` | Required | List articles for team | Query: `team_id` |
| `/api/posts/articles/{article_id}/` | `GET` | Required | Article detail | Path: `article_id` |
| `/api/posts/articles/{article_id}/` | `PATCH` | Required | Edit own article (author-only) | Path: `article_id`, Body: `title`, `body`, `type`, `tags` |
| `/api/posts/questions/{question_id}/` | `GET` | Required | Question detail (question + answers + comments + mentions + bounty) | Path: `question_id` |
| `/api/posts/questions/{question_id}/` | `PATCH` | Required | Edit own question (author-only) | Path: `question_id`, Body: `title`, `body`, `tags?` |

### Question Interactions

| Endpoint | Method | Auth | Purpose | Key Inputs |
|---|---|---|---|---|
| `/api/posts/questions/{question_id}/follow/` | `POST` | Required | Follow question | Path: `question_id` |
| `/api/posts/questions/{question_id}/unfollow/` | `POST` | Required | Unfollow question | Path: `question_id` |
| `/api/posts/questions/{question_id}/mentions/` | `POST` | Required | Add mentions | Path: `question_id`, Body: `user_ids` |
| `/api/posts/questions/{question_id}/mentions/remove/` | `POST` | Required | Remove one mention | Path: `question_id`, Body: `user_id` |
| `/api/posts/questions/{question_id}/bounty/offer/` | `POST` | Required | Offer bounty on own question (author-only) | Path: `question_id`, Body: `reason` |
| `/api/posts/questions/{question_id}/bounty/award/` | `POST` | Required | Award bounty on own question (author-only) | Path: `question_id`, Body: `answer_id` |
| `/api/posts/questions/{question_id}/close/` | `POST` | Required | Close question (team member) | Path: `question_id`, Body: `reason` (`duplicate` or `off-topic`), `duplicate_post_id` (required for duplicate) |
| `/api/posts/questions/{question_id}/reopen/` | `POST` | Required | Reopen question (author or team admin) | Path: `question_id` |
| `/api/posts/questions/{question_id}/delete/` | `POST` | Required | Soft-delete own question (author-only) | Path: `question_id` |
| `/api/posts/questions/{question_id}/undelete/` | `POST` | Required | Restore own question (author-only) | Path: `question_id` |

Additional bounty behavior:
- Expired offered bounties are removed lazily on question list/detail reads and before bounty offer/award processing.
- Cleanup deletes expired `Bounty` rows and resets `Post.bounty_amount` to `0`.

### Bookmarks and Follows

| Endpoint | Method | Auth | Purpose | Key Inputs |
|---|---|---|---|---|
| `/api/posts/bookmarks/` | `POST` | Required | Bookmark a post or collection | Body: exactly one of `post_id` or `collection_id` |
| `/api/posts/bookmarks/remove/` | `POST` | Required | Remove bookmark | Body: exactly one of `post_id` or `collection_id` |
| `/api/posts/bookmarks/list/` | `GET` | Required | List bookmarks in team scope | Query: `team_id`, `user_id?` |
| `/api/posts/follows/list/` | `GET` | Required | List followed questions in team scope | Query: `team_id`, `user_id?` |

## Tags API

| Endpoint | Method | Auth | Purpose | Key Inputs |
|---|---|---|---|---|
| `/api/tags/search/` | `GET` | Public | Global tag search | Query: `q` |
| `/api/tags/list/` | `GET` | Required | Team tags list | Query: `team_id` |
| `/api/tags/preferences/list/` | `GET` | Required | Current user tag preferences in team | Query: `team_id` |
| `/api/tags/preferences/` | `POST` | Required | Update watch/ignore state for tag | Body: `team_id`, `tag_id`, `field` (`is_watching` or `is_ignored`), `value` |

## Notifications API

| Endpoint | Method | Auth | Purpose | Key Inputs |
|---|---|---|---|---|
| `/api/notifications/list/` | `GET` | Required | List notifications (max 100) for team | Query: `team_id` |
| `/api/notifications/{notification_id}/read/` | `POST` | Required | Mark one notification read | Path: `notification_id` |
| `/api/notifications/{notification_id}/unread/` | `POST` | Required | Mark one notification unread | Path: `notification_id` |
| `/api/notifications/read-all/` | `POST` | Required | Mark all notifications read in team | Body: `team_id` |

## Comments API

| Endpoint | Method | Auth | Purpose | Key Inputs |
|---|---|---|---|---|
| `/api/comments/` | `POST` | Required | Create comment or reply | Body: `body`, plus either `post_id` or `collection_id`; for reply use `parent_comment_id` |
| `/api/comments/{comment_id}/` | `PATCH` | Required | Edit own comment | Path: `comment_id`, Body: `body` |
| `/api/comments/{comment_id}/` | `DELETE` | Required | Delete own comment | Path: `comment_id` |

## Reputation API

| Endpoint | Method | Auth | Purpose | Key Inputs |
|---|---|---|---|---|
| `/api/reputation/history/` | `GET` | Required | Grouped reputation history | Query: `team_id`, `user_id?`, `page?`, `page_size?` |

## Collections API

| Endpoint | Method | Auth | Purpose | Key Inputs |
|---|---|---|---|---|
| `/api/collections/` | `POST` | Required | Create collection (admin-only) | Body: `team_id`, `title`, `description?` |
| `/api/collections/list/` | `GET` | Required | Paginated list of team collections | Query: `team_id`, `page?`, `page_size?` |
| `/api/collections/{collection_id}/` | `GET` | Required | Collection detail | Path: `collection_id` |
| `/api/collections/{collection_id}/upvote/` | `POST` | Required | Upvote collection | Path: `collection_id` |
| `/api/collections/{collection_id}/upvote/remove/` | `POST` | Required | Remove collection upvote | Path: `collection_id` |
| `/api/collections/{collection_id}/comments/` | `POST` | Required | Add comment to collection | Path: `collection_id`, Body: `body` |
| `/api/collections/{collection_id}/search-posts/` | `GET` | Required | Search posts eligible for collection | Path: `collection_id`, Query: `q` |
| `/api/collections/{collection_id}/posts/` | `POST` | Required | Add post to collection (admin-only) | Path: `collection_id`, Body: `post_id` |

## Votes API

| Endpoint | Method | Auth | Purpose | Key Inputs |
|---|---|---|---|---|
| `/api/votes/` | `POST` | Required | Submit vote on post/comment | Body: exactly one of `post_id` or `comment_id`, and `vote` (`-1` or `1`) |
| `/api/votes/remove/` | `POST` | Required | Remove vote from post/comment | Body: exactly one of `post_id` or `comment_id` |

Vote side-effects:
- Vote count updates run inside the vote transaction.
- Reputation effects are emitted as vote-domain events and applied by reputation receivers after commit.

## Non-API Route

- Django admin: `/admin/`
