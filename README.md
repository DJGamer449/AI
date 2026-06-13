# MelanTrance's Private Unlimited AI

A private, password-protected AI chat web app with a FastAPI backend proxy for Orbit Provider and a responsive Tailwind-powered SPA frontend.

## Security model

- The browser never receives the Orbit API key.
- `APP_PASSWORD` unlocks the UI and creates an HTTP-only signed session cookie.
- `/api/models` and `/api/chat` are blocked unless the signed cookie is valid.
- Store secrets in environment variables; do not commit `.env`.

## Quick start

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# edit .env and set APP_PASSWORD, ORBIT_API_KEY, and APP_SECRET
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Open <http://localhost:8000>.

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `APP_PASSWORD` | Yes | Master password used to unlock the app. |
| `ORBIT_API_KEY` | Yes | Server-side Orbit Provider API key. |
| `APP_SECRET` | Recommended | Secret used to sign session cookies. Falls back to `APP_PASSWORD` if omitted. |
| `ORBIT_BASE_URL` | No | Defaults to Orbit's `/api/provider/agy/v1` base URL. |
| `SESSION_TTL_SECONDS` | No | Cookie lifetime; defaults to 86400. |
| `CORS_ORIGINS` | No | Comma-separated origins if serving the frontend separately. |
| `COOKIE_SECURE` | No | Set to `true` when serving over HTTPS in production. |

## API routes

- `POST /api/auth/login` with `{ "password": "..." }`
- `POST /api/auth/logout`
- `GET /api/auth/session`
- `GET /api/models`
- `POST /api/chat`

## Production notes

Run behind HTTPS and set `COOKIE_SECURE=true` so browsers only send the session cookie over encrypted connections. Keep the default `false` only for local development or trusted internal networks.

## Docker

```bash
docker build -t melantrance-private-ai .
docker run --rm -p 8000:8000 \
  -e APP_PASSWORD='replace-me' \
  -e ORBIT_API_KEY='sk-orbit-...' \
  -e APP_SECRET='replace-with-random-secret' \
  -e COOKIE_SECURE=false \
  melantrance-private-ai
```
