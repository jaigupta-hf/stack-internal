# Frontend Overview

This frontend is a React + Vite single-page app for Stack Internal. It provides:

- Google-based login and session restore
- Team-aware routing (`/:teamSlug/:tabSlug`)
- A tabbed workspace for collaboration features:
	- Home
	- Questions
	- Articles
	- Collections
	- For You (notifications)
	- Bookmarks
	- Tags
	- Users
	- Admin Settings
- Profile pages, global search, and URL-synced detail views

## High-Level Architecture

### 1) App Shell and Routing

- `src/App.jsx` is the orchestration layer.
- Responsibilities:
	- Auth bootstrap (`getCurrentUser`)
	- Team hydration from URL slug
	- Tab and profile URL sync
	- Global search and shared top-level UI state
	- Gatekeeping member/admin access

### 2) Feature Screens

- `src/pages/` contains page-level entry screens (`LoginPage`, `TeamsPage`, `ProfilePage`).
- `src/pages/navigationTabs/` contains each primary product area as a tab module.
- `src/components/` contains reusable and feature-scoped presentation components.
- `src/hooks/` contains stateful domain and controller hooks used by tabs/components.

### 3) Data Layer (API Services)

- `src/services/config.js`
	- Shared Axios client
	- Token storage and auth interceptors
	- Pagination helpers (`withPaginationParams`, `asList`, `asPaginated`)
- `src/services/*-api.js`
	- Domain-specific API wrappers
- `src/services/api.js`
	- Barrel export for a single import surface across the app

## Services Folder Arrangement

Current arrangement is good and follows a practical domain-based structure.

Current modules:

- `login-api.js` (auth/profile)
- `teams-api.js`
- `post-api.js`
- `collection-api.js`
- `notification-api.js`
- `reputation-api.js`
- `tags-api.js`
- `comments-api.js`
- `vote-api.js`
- `config.js` (transport + shared helpers)
- `api.js` (barrel exports)

Why this is a correct approach:

- Keeps API concerns out of UI components.
- Groups calls by backend domain, which scales better than one giant file.
- Centralizes auth header and 401 handling.
- Makes imports consistent via `src/services/api.js`.

Recommended conventions as the app grows:

- Keep service modules thin: transport and payload shaping only.
- Keep UI/data transformation logic in hooks or domain utilities.
- Prefer importing through `src/services/api.js` to avoid deep, inconsistent imports.
- If a service file becomes very large, split by sub-domain (example: `post-question-api.js`, `post-article-api.js`) while preserving barrel exports.

## Backend Integration

- Base URL: `VITE_API_URL` + `/api`
- Bearer token is attached by Axios request interceptor.
- On 401, tokens are cleared and user is redirected to login.

### Pagination Pattern

- Shared option shape: `{ page?: number, pageSize?: number }`
- `pageSize` is mapped to backend `page_size`
- Many list endpoints expose both:
	- `list*Page(...)` for full payload (`items + pagination`)
	- `list*(...)` for backward-compatible array usage

## Local Development

```bash
cd frontend
npm install
npm run dev
```

Set env vars in `frontend/.env`:

- `VITE_GOOGLE_CLIENT_ID`
- `VITE_API_URL`
