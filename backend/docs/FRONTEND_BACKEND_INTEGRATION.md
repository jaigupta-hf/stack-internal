# Frontend-Backend Integration Contract

This document captures the verified API contract between frontend service methods and backend endpoints, with focus on list filtering and pagination.

## Core Rules

- Team-scoped reads must include `team_id` where required by endpoint.
- Pagination options from frontend use `{ page, pageSize }` and are translated to backend query params `page` and `page_size`.
- Existing list service methods that historically returned arrays remain backward compatible.
- New `*Page` methods return full payloads (including `pagination` when provided by backend).

## Service Mapping

| Frontend Service Method | Endpoint | Query/Body Contract | Return Shape |
|---|---|---|---|
| `postService.listQuestionsPage(teamId, {page,pageSize})` | `GET /api/posts/questions/list/` | Query: `team_id`, optional `page`, `page_size` | `{ items, pagination }` |
| `postService.listQuestions(teamId, opts)` | `GET /api/posts/questions/list/` | Same as above | `items[]` |
| `collectionService.listCollectionsPage(teamId, {page,pageSize})` | `GET /api/collections/list/` | Query: `team_id`, optional `page`, `page_size` | `{ items, pagination }` |
| `collectionService.listCollections(teamId, opts)` | `GET /api/collections/list/` | Same as above | `items[]` |
| `teamService.listTeamUsersPage(teamId, {page,pageSize})` | `GET /api/teams/{team_id}/users/` | Path: `team_id`; optional `page`, `page_size` | `{ items, pagination }` |
| `teamService.listTeamUsers(teamId, opts)` | `GET /api/teams/{team_id}/users/` | Same as above | `items[]` |
| `reputationService.listHistory(teamId, userId, {page,pageSize})` | `GET /api/reputation/history/` | Query: `team_id`, optional `user_id`, `page`, `page_size` | `{ user_id, groups, pagination }` |
| `postService.listArticles(teamId, {page,pageSize})` | `GET /api/posts/articles/list/` | Query: `team_id`, optional `page`, `page_size` | `items[]` |
| `postService.listBookmarks(teamId, userId, {page,pageSize})` | `GET /api/posts/bookmarks/list/` | Query: `team_id`, optional `user_id`, `page`, `page_size` | `items[]` |
| `postService.listFollowedPosts(teamId, userId, {page,pageSize})` | `GET /api/posts/follows/list/` | Query: `team_id`, optional `user_id`, `page`, `page_size` | `items[]` |

## Notes

- Some backend endpoints apply pagination server-side but currently return arrays instead of `{ items, pagination }` payloads (for example: articles, bookmarks, follows). Frontend supports passing pagination params to these endpoints already.
- If UI-level pagination controls are introduced, prefer `*Page` methods wherever response includes pagination metadata.
