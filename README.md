# Stack Internal

Monorepo for Stack Internal with:

- `backend/`: Django + DRF API
- `frontend/`: React + Vite web app

## Prerequisites

- Python 3.11+ (recommended)
- Node.js 18+ and npm
- PostgreSQL (for local backend database)

## Repository Structure

```text
stack-internal/
  backend/
  frontend/
```

## Environment Setup

Create environment files:

- `backend/.env`
- `frontend/.env`

## Backend Setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

Backend runs at:

- `http://localhost:8000`
- API base: `http://localhost:8000/api`

## Frontend Setup

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at the Vite URL shown in terminal (commonly `http://localhost:5173`).

## Start Both Services

1. Start backend first (`python manage.py runserver`).
2. Start frontend (`npm run dev`).
3. Open the frontend URL in your browser.

## Notes

- Backend and frontend have separate dependency trees and env files.
- App-specific architecture and API details remain in:
  - `backend/README.md`
  - `frontend/README.md`
