# Posts App Context

## Purpose
This is the largest domain app. It owns questions, answers, article-like posts, and user interactions around posts.

It handles:
- Question and answer lifecycle.
- Article lifecycle.
- Question interactions: follow, mentions, bounty, close/reopen, delete/undelete.
- Bookmarks and followed-post lists.
- Rich detail/list/search payloads.

## Main Files
- `models.py`: `Post`, `Bookmark`, `PostFollow`.
- `views.py`: primary entry module; also re-exports handlers from submodules.
- `views_questions.py`: question read/search/update and moderation flows.
- `viewsets.py`: router-backed article/question list/create/detail/update endpoints.
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

## Developer Guidance
- Keep module split boundaries (questions/articles/bookmarks) intact.
- Wrap multi-model writes in `transaction.atomic()`.
- Reuse serializer contracts for stable response shape.
- Preserve membership checks before any team-scoped read/write.
- For new interaction features, add shared bits to `views_common.py` when broadly reusable.