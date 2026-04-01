# Frontend Overview

This frontend is a React app that drives the Stack Internal user experience.
At a high level, it handles:

- Sign-in with Google
- Session restore on refresh
- Team listing and team creation after login

## UI Flow

1. App starts and checks whether a session token exists.
2. If no valid session is found, user sees LoginPage.
3. After successful login, user is taken to TeamsPage.
4. TeamsPage allows listing existing teams and creating new teams.

## Architecture At A Glance

- src/App.jsx
	- Entry flow controller for auth check and page switching
- src/pages/LoginPage.jsx
	- Google OAuth entry point
- src/pages/TeamsPage.jsx
	- Authenticated workspace for teams
- src/services/
	- config.js: shared axios client, token storage, interceptors
	- login-api.js: user auth service calls
	- teams-api.js: teams service calls
	- api.js: single import surface for all service modules

## Integration With Backend

- Frontend calls backend via VITE_API_URL + /api base path.
- Bearer token is attached automatically by axios interceptor.
- 401 responses clear token state and force a return to login.

## Running Locally

```bash
cd frontend
npm install
npm run dev
```

Use frontend/.env to set:

- VITE_GOOGLE_CLIENT_ID
- VITE_API_URL

## Developer Guidance

- Keep page-level logic in pages and API logic in services.
- Reuse src/services/api.js exports instead of importing deep service files across the app.
- When adding new protected screens, follow the same auth-guard pattern used in App.jsx.
