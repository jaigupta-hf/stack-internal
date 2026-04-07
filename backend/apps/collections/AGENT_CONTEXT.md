# Collections App Context

## Purpose
This app implements team-curated collections and collection-level interactions.

It provides:
- Collection creation/list/detail.
- Collection vote upvote/remove-upvote.
- Collection comments.
- Search eligible posts for collection.
- Add post to collection with sequence ordering.

## Main Files
- `models.py`: `Collection`, `PostCollection`.
- `views.py`: all collection endpoints.
- `serializers.py`: input/output contracts.
- `urls.py`: routes under `/api/collections/*`.

## Data Model
### `Collection`
- Team-scoped curated container with owner and counters.

### `PostCollection`
- Join model linking post to collection with `sequence_number`.
- Enforces unique `(post, collection)` and unique sequence per collection.

## Endpoints
Base path: `/api/collections/`

- `POST /` -> create collection (team admin required).
- `GET /list/` -> paginated collection list for team.
- `GET /{collection_id}/` -> collection detail with posts and comments.
- `POST /{collection_id}/upvote/` -> upvote collection.
- `POST /{collection_id}/upvote/remove/` -> remove collection upvote.
- `POST /{collection_id}/comments/` -> add comment on collection.
- `GET /{collection_id}/search-posts/` -> search team posts to add.
- `POST /{collection_id}/posts/` -> add post to collection (team admin required).

## Key Logic Points
- Team membership checks are required for all read/write access.
- Admin checks are required for create collection and add-post actions.
- Detail endpoint increments view count and computes current-user vote/bookmark state.
- Add-post endpoint computes next sequence number from current max.

## Cross-App Dependencies
- `posts` for post data, bookmarks, and post types.
- `comments` for collection comments.
- `votes` for collection vote state.
- `teams` for membership/admin checks and display names.

## Developer Guidance
- Keep sequence-number uniqueness invariant when changing add/reorder logic.
- Wrap multi-step mutating operations with transactions.
- Preserve list pagination contract (`items` + `pagination`).
- Maintain post type allowlist for collection eligibility.