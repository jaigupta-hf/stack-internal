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

## Main Files
- `models.py`: `Post`, `Bookmark`, `PostFollow`.
- `views.py`: entry module for answer lifecycle, question search, and bookmark endpoints.
- `views_questions.py`: question and global title search handlers.
- `viewsets.py`: router-backed question/article list/create/detail/update plus question interaction and moderation actions.
- `views_bookmarks.py`: bookmark and follows list endpoints.
- `views_common.py`: shared helpers/constants.
- `serializers.py`: large input/output schema surface.
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
- `notifications.api/models`: side-effect notifications.
- `reputation.api/models`: reputation changes and bounties.
- `comments.models`, `votes.models`, `apps.collections.models`: detail payload composition.

## Key Side Effects
- Tag counters and user tag usage updated when creating/editing content.
- Notifications emitted for answer/comment/edit/approval events.
- Reputation adjusted for accepts, upvotes/downvotes, and bounty actions.
- Counter fields (`answer_count`, `vote_count`, `bookmarks_count`, `views_count`) updated incrementally.
- Expired offered bounties are cleaned lazily on question reads and bounty actions (bounty row deleted, `Post.bounty_amount` reset to `0`).

## Developer Guidance
- Keep question/article CRUD and question actions in `viewsets.py`; keep answer/search/bookmark concerns in their focused modules.
- Wrap multi-model writes in `transaction.atomic()`.
- Reuse serializer contracts for stable response shape.
- Preserve membership checks before any team-scoped read/write.
- For new interaction features, add shared bits to `views_common.py` when broadly reusable.