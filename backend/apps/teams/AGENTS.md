# Teams App Context For AI Agents

This document captures contract and behavior expectations for automated edits in the teams app.

## Scope

The teams app currently owns:

- Team creation
- Listing teams for the authenticated user
- Team lookup by slug
- Paginated team member listing with membership check

## Route Contracts

Base path: /api/teams/

- GET /
  - Auth required
  - Returns teams where request.user is a member
  - Response item fields: id, name, url_endpoint, is_admin

- POST /
  - Auth required
  - Body: { "name": string, "url_endpoint": string }
  - Creates team and creates TeamUser row for creator with is_admin=true

- GET /by-slug/<url_endpoint>/
  - Auth required
  - Returns team meta + membership flags
  - Response fields: id, name, url_endpoint, is_member, is_admin

- GET /<team_id>/users/?page=<n>&page_size=<n>
  - Auth required
  - Requester must belong to team
  - Returns: { "items": [...], "pagination": {...} }

Do not change these response shapes unless frontend services/components are updated together.

## Model Notes

- Team table: teams
- TeamUser table: team_users
- TeamUser unique constraint on (team, user)
- TeamUser stores role-related profile fields (is_admin, reputation, title, about, impact)

## Dependencies

- Authentication uses users.utils.auth.JWTAppUserAuthentication from REST_FRAMEWORK settings.
- Pagination helpers are imported from pagination (backend/apps/pagination.py).

## Safe Change Checklist

1. Run python manage.py check.
2. Verify GET /api/teams/ returns 401 without token.
3. Verify POST /api/teams/ creates team + creator membership.
4. Verify GET /api/teams/<id>/users/ enforces membership check.
5. Verify frontend TeamsPage still loads teams and creates new team.
