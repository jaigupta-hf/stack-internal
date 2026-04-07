# Tags App Context

## Purpose
This app manages tag entities, post-tag mappings, and per-user tag preferences.

It provides:
- Global tag search.
- Team-scoped tag listing.
- Team-scoped tag preference listing and updates.
- Shared tag sync utilities used by posts workflows.

## Main Files
- `models.py`: `Tag`, `TagPost`, `TagUser`.
- `views.py`: public and authenticated tag endpoints.
- `api.py`: reusable tag sync and serialization helpers.
- `serializers.py`: input/output validation.
- `urls.py`: routes under `/api/tags/*`.

## Data Model
- `Tag`: canonical tag metadata and counters (`question_count`, `article_count`, `watch_count`, `about`).
- `TagPost`: mapping between a tag and a post.
- `TagUser`: per-user tag usage and preferences (`is_watching`, `is_ignored`, `count`).

## Endpoints
Base path: `/api/tags/`

- `GET search/` -> global tag search (public).
- `GET list/` -> team tag list.
- `GET preferences/list/` -> current user tag preferences in a team.
- `POST preferences/` -> update watch/ignore preference for one tag.

## Shared API Helpers (`api.py`)
- `normalize_tag_names(tag_names)`
- `tag_prefetch(to_attr=...)`
- `serialize_post_tags(post, prefetched_attr=...)`
- `sync_post_tags(post, tag_names)`
- `sync_user_tags_for_post(user, post)`

These are heavily used by the posts app.

## Important Rules
- Tag names are normalized and deduplicated.
- `is_watching` and `is_ignored` are mutually exclusive.
- Preference updates adjust `Tag.watch_count` with safe floor at zero.
- Team endpoints require membership via `ensure_team_membership`.

## Cross-App Dependencies
- Depends on `posts` models for team/post filtering.
- Consumed by posts create/edit/list/detail flows.

## Developer Guidance
- Prefer calling `sync_post_tags` rather than writing TagPost rows manually.
- Keep tag counter updates atomic and idempotent.
- Preserve serializer strictness in output serializers to avoid response-time 400 errors.