# Stack Internal Backend

This backend is a Django + DRF API that powers team-based Q&A, knowledge posts, collections, voting, tags, notifications, and reputation.

## What This Backend Owns

- Authentication using Google token exchange and app JWT issuance.
- Team lifecycle and team membership/role enforcement.
- Content lifecycle for questions, answers, and article-style posts.
- Cross-content interactions: comments, votes, bookmarks, follows, mentions, bounties.
- Discovery and personalization: search, tag preferences, notifications, reputation history.

## Tech Stack

- Python + Django
- Django REST Framework
- PostgreSQL
- Token auth via custom DRF authentication class: `users.utils.auth.JWTAppUserAuthentication`

## Project Structure

```text
backend/
  config/
    settings.py          # Django settings, DRF auth config, CORS, DB config
    urls.py              # Root route mounting for all apps under /api
  apps/
    users/               # Auth and profile APIs
    teams/               # Team and team membership APIs + permission helpers
    posts/               # Questions, answers, articles, follows, mentions, bounty, bookmarks
    tags/                # Team tags and user tag preferences
    notifications/       # Notification feed + read state updates
    comments/            # Comment create/update/delete
    votes/               # Vote submit/remove for posts and comments
    reputation/          # Reputation history + bounty side effects
    collections/         # Curated collections and collection interactions
    pagination.py        # Shared page/page_size parsing + pagination payload helper
```

## High-Level Runtime Flow

1. Client exchanges Google credential at `POST /api/users/auth/google/`.
2. Backend issues JWT token and user payload.
3. Frontend sends bearer token for protected endpoints.
4. Team-scoped endpoints validate membership using shared helpers in `apps/teams/permissions.py`.
5. Business logic executes and serializes response via input/output serializers.
6. Side effects (notifications, reputation changes, counts, follows, tag stats) are applied transactionally where needed.

## Domain Model Overview

- `users.User`: Profile identity used across the app.
- `teams.Team` + `teams.TeamUser`: Team container plus membership and role (`is_admin`) with reputation.
- `posts.Post`: Unified content table for question, answer, and article-like content types.
- `comments.Comment`: Comments on posts or collections, including replies.
- `votes.Vote`: `+1/-1` voting on posts/comments.
- `posts.Bookmark` + `posts.PostFollow`: Saved items and follow graph.
- `tags.Tag`, `tags.TagPost`, `tags.TagUser`: Tag metadata, post-tag mapping, user preference state.
- `notifications.Notification`: User-targeted event feed.
- `reputation.ReputationHistory` + `reputation.Bounty`: Reputation ledger and bounty lifecycle.
- `collections.Collection` + `collections.PostCollection`: Curated content buckets and ordering.

## API Documentation

- Full endpoint reference: [docs/API_REFERENCE.md](docs/API_REFERENCE.md)
- Frontend integration contract: [docs/FRONTEND_BACKEND_INTEGRATION.md](docs/FRONTEND_BACKEND_INTEGRATION.md)
- Root route mapping: [config/urls.py](config/urls.py)

## App Context Files

- [apps/users/AGENT_CONTEXT.md](apps/users/AGENT_CONTEXT.md)
- [apps/teams/AGENT_CONTEXT.md](apps/teams/AGENT_CONTEXT.md)
- [apps/posts/AGENT_CONTEXT.md](apps/posts/AGENT_CONTEXT.md)
- [apps/tags/AGENT_CONTEXT.md](apps/tags/AGENT_CONTEXT.md)
- [apps/notifications/AGENT_CONTEXT.md](apps/notifications/AGENT_CONTEXT.md)
- [apps/comments/AGENT_CONTEXT.md](apps/comments/AGENT_CONTEXT.md)
- [apps/reputation/AGENT_CONTEXT.md](apps/reputation/AGENT_CONTEXT.md)
- [apps/collections/AGENT_CONTEXT.md](apps/collections/AGENT_CONTEXT.md)
- [apps/votes/AGENT_CONTEXT.md](apps/votes/AGENT_CONTEXT.md)

## API Surface Summary

- `/api/users/`: auth and profiles
- `/api/teams/`: teams and members
- `/api/posts/`: core posting and interactions
- `/api/tags/`: tag catalog and preferences
- `/api/notifications/`: user notifications
- `/api/comments/`: comments
- `/api/reputation/`: reputation history
- `/api/collections/`: collections
- `/api/votes/`: votes

## Local Development

```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 3000
```

## Environment Variables

Configuration is loaded from `backend/.env`.

| Variable | Purpose |
|---|---|
| `SECRET_KEY` | Django secret key |
| `DB_NAME` | PostgreSQL database name |
| `DB_USER` | PostgreSQL username |
| `DB_PASSWORD` | PostgreSQL password |
| `DB_HOST` | PostgreSQL host |
| `DB_PORT` | PostgreSQL port |
| `GOOGLE_OAUTH_CLIENT_ID` | Google client ID for token verification |

## Important Backend Conventions

- Membership and admin checks are centralized in `apps/teams/permissions.py`.
- List endpoints should reuse `apps/pagination.py` for consistent paging metadata.
- Keep serializer-driven request/response validation close to each endpoint.
- Prefer adding new behavior in domain-specific modules (for example, split views in posts app) instead of growing monolithic view files.

## Notes For Contributors

- Prefer additive API changes and keep response contracts stable where possible.
- For new team-scoped endpoints, enforce membership before business logic.
- If an endpoint mutates multiple related models, wrap updates in transactions.

## Indexing And Performance Conventions

- Define intended indexes in model `Meta.indexes` so query intent stays visible in schema code.
- In this repository's legacy migration setup, apply index rollout with DB-only `RunSQL` migrations (using `IF NOT EXISTS`) until full initial migrations are baselined.
- Keep explicit index names at 30 characters or fewer to satisfy Django model checks.
- Prefer composite indexes that match real query patterns (`WHERE` + `ORDER BY`) over broad speculative indexing.
