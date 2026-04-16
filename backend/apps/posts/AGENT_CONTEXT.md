# Posts App Context

## Purpose
This is the largest domain app. It owns questions, answers, article-like posts, and user interactions around posts.

It handles:
- Question and answer lifecycle.
- Article lifecycle.
- Question interactions: follow, mentions, bounty, close/reopen, delete/undelete.
- Bookmarks and followed-post lists.
- Rich detail/list/search payloads.

Current enforcement highlights:
- Question edit/delete/undelete is author-only.
- Answer edit/delete/undelete is author-only.
- Article edit is author-only.
- Question bounty offer/award and mention removal are author-only.
- Question close is allowed to any authenticated team member.
- Question reopen is restricted to question author or team admin.

## Main Files
- `models.py`: `Post`, `Bookmark`, `PostFollow`, `PostActivity`, `PostVersion`.
- `api/viewsets.py`: router-backed question/article CRUD and question interactions.
- `api/views.py`: answer lifecycle and approve-answer handlers.
- `api/views_questions.py`: question and global title search handlers.
- `api/views_bookmarks.py`: bookmark and follows list endpoints.
- `api/views_common.py`: shared response/helper utilities.
- `api/serializers.py`: input/output schema surface.
- `api/permissions.py`: post author/admin permission classes.
- `services/posts.py`: content workflows (question/article/answer create/update/delete/undelete).
- `services/interactions.py`: bounty and question state transitions.
- `services/tracking.py`: post activity and version snapshot helpers.
- `domain_events.py`: app-domain events emitted on commit for cross-app side effects.
- `urls.py`: routes under `/api/posts/*`.

## Post Types
Stored in `Post.type`:
- `0`: question
- `1`: answer
- `20`: announcement
- `21`: how-to guide
- `22`: knowledge article
- `23`: policy

## Endpoint Areas
Base path: `/api/posts/`

Question/article CRUD is implemented in DRF ViewSets. Compatibility aliases like `questions/list/` and `articles/list/` are preserved and routed to ViewSet actions.

### Creation and editing
- `POST questions/`
- `POST articles/`
- `POST questions/{question_id}/answers/`
- `PATCH answers/{answer_id}/`
- `PATCH questions/{question_id}/`
- `PATCH articles/{article_id}/`

### Read/list/search
- `GET questions/list/`
- `GET questions/search/`
- `GET search/global/`
- `GET questions/{question_id}/`
- `GET articles/list/`
- `GET articles/{article_id}/`

### Question state transitions
- `PATCH questions/{question_id}/approve-answer/`
- `POST questions/{question_id}/close/`
- `POST questions/{question_id}/reopen/`
- `POST questions/{question_id}/delete/`
- `POST questions/{question_id}/undelete/`
- `POST answers/{answer_id}/delete/`
- `POST answers/{answer_id}/undelete/`

### Interactions
- `POST questions/{question_id}/follow/`
- `POST questions/{question_id}/unfollow/`
- `POST questions/{question_id}/mentions/`
- `POST questions/{question_id}/mentions/remove/`
- `POST questions/{question_id}/bounty/offer/`
- `POST questions/{question_id}/bounty/award/`

### Bookmarks/follows
- `POST bookmarks/`
- `POST bookmarks/remove/`
- `GET bookmarks/list/`
- `GET follows/list/`

## Cross-App Dependencies
- `teams.permissions`: membership guards.
- `tags.api`: tag syncing, prefetch, serialization.
- `notifications`: receives post domain events and creates notifications.
- `reputation`: receives post domain events and applies reputation changes.
- `comments.models`, `votes.models`, `apps.collections.models`: detail payload composition.

## Key Side Effects
- Tag counters and user tag usage updated when creating/editing content.
- Post lifecycle methods emit events via `domain_events.emit_post_event(...)`.
- Notifications and reputation are handled by receivers in their own apps.
- Counter fields (`answer_count`, `vote_count`, `bookmarks_count`, `views_count`) updated incrementally.
- Expired offered bounties are cleaned lazily on question reads and bounty actions (bounty row deleted, `Post.bounty_amount` reset to `0`).

## Developer Guidance
- Keep HTTP concerns in `api/*` and business orchestration in `services/*`.
- Wrap multi-model writes in `transaction.atomic()`.
- Reuse serializer contracts for stable response shape.
- Preserve membership checks before any team-scoped read/write.
- Prefer emitting domain events for cross-app side effects instead of importing other app APIs directly.