# Frontend Developer Guide

This frontend is a React + Vite app for Stack Internal.
Current implementation focuses on Google sign-in and authenticated session handling against the Django backend.

## Tech Stack

- React 19
- Vite 8
- Tailwind CSS 4
- Axios
- @react-oauth/google

## Project Structure

frontend/
- src/
	- App.jsx                   Session bootstrap and authenticated shell
	- pages/LoginPage.jsx       Google OAuth login screen
	- services/
		- config.js               Axios instance, token storage, interceptors
		- login-api.js            Auth service methods
		- api.js                  Barrel exports for service imports
- .env                        Frontend runtime env vars
- package.json

## Environment Variables

Set these in frontend/.env:

- VITE_GOOGLE_CLIENT_ID
- VITE_API_URL (example: http://localhost:3000)

## Local Development

```bash
cd frontend
npm install
npm run dev
```

Useful commands:

- npm run build
- npm run preview
- npm run lint

## Authentication Flow

1. LoginPage receives Google credential token.
2. authService.googleLogin posts token to /users/auth/google/.
3. Backend returns user + tokens.
4. tokenService stores access/refresh tokens in localStorage.
5. api interceptor adds Authorization header to subsequent requests.
6. App checks auth/me on load to restore session state.

## API Access Pattern

- Import service helpers from src/services/api.js.
- Use authService for login/session/logout operations.
- Use api for generic authenticated calls.
- Use asList when endpoint payload may vary between array and object wrappers.

## Troubleshooting

- Login popup or One Tap issues: verify VITE_GOOGLE_CLIENT_ID and authorized origins in Google Cloud.
- 401 responses: clear localStorage tokens and log in again.
- CORS errors: ensure backend CORS_ALLOWED_ORIGINS includes current frontend origin.
