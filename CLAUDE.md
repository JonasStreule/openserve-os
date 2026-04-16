# immerdra.ch — POS System (Claude Context)

## Project Overview
Restaurant POS system live at **immerdra.ch**. Brand landing page at **edv.sg**.
Operated by Sünneli GmbH (CHE-442.906.842), St. Gallen.

## Stack

### Backend (`/src`)
- **Runtime**: Node.js 20 + TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL (via `pg` driver, raw SQL — no ORM)
- **Auth**: JWT (jsonwebtoken) + bcryptjs
- **Real-time**: WebSocket (`ws` library, attached to HTTP server)
- **Security**: helmet, cors, express-rate-limit (`trust proxy: 1` set)
- **Monitoring**: Sentry (`@sentry/node`, optional via env)
- **Entry**: `src/main.ts` → compiled to `dist/`

### Frontend (`/frontend/src`)
- **Framework**: React 18 + TypeScript + Vite
- **Routing**: react-router-dom
- **Real-time**: Custom `useWebSocket` hook → connects to `/ws?channel=...`
- **PDF/QR**: qrcode + custom print utilities
- **Monitoring**: Sentry (`@sentry/react`, optional)
- **No CSS framework** — custom CSS variables in `index.css`

### Infrastructure
- **Server**: Hetzner VPS at `204.168.255.134`, SSH key `~/.ssh/hetzner`
- **Reverse proxy**: Caddy (HTTP only, Cloudflare handles SSL)
- **SSL**: Cloudflare Flexible SSL (HTTPS → Cloudflare → HTTP → Caddy → Docker)
- **Containers**: Docker Compose (`docker-compose.prod.yml`)
  - `backend` → port 3000
  - `frontend` (nginx) → port 8080
  - `postgres` → port 5432
  - `redis` → port 6379
- **App path on server**: `/opt/immerdra/`
- **Static site**: `/var/www/edv/` (edv.sg landing page, plain HTML)

### Cloudflare Routing (Caddyfile)
```
/api/*  → backend:3000
/ws*    → backend:3000   ← WebSocket
/*      → frontend:8080
```

## Environment Variables (keys only)
```
DATABASE_URL        PostgreSQL connection string
REDIS_URL           Redis connection string
JWT_SECRET          JWT signing secret
JWT_EXPIRY          Token lifetime (default 8h)
PORT                Backend port (default 3000)
NODE_ENV            development | production
CORS_ORIGIN         Comma-separated allowed origins
SENTRY_DSN          Sentry error tracking (optional)
VITE_API_URL        Frontend API base URL (optional)
VITE_WS_URL         Frontend WebSocket URL (optional)
```

## Database Migrations
Located in `/migrations/`, run automatically on container start.
Files: `001_initial_schema` → `011_schema_hardening`

## Demo Credentials (seed data)
| Role | Username | PIN |
|------|----------|-----|
| Admin | Admin | 0000 |
| Service | Anna / Marco / Luca | 1234 |
| Foodtruck | Kai / Sam | 0101 |
| Kitchen station | — | 5555 |
| Buffet station | — | 6666 |

## Deploy Workflow
```bash
# On local machine:
git push origin main

# On server:
ssh -i ~/.ssh/hetzner root@204.168.255.134
cd /opt/immerdra && git pull && docker compose -f docker-compose.prod.yml up -d --build
```

## Key Design Decisions
- **No ORM** — raw SQL with pg for full control and performance
- **WebSocket path `/ws`** — Caddy routes `/ws*` to backend; frontend connects to `${wsUrl}/ws?channel=X`
- **Cloudflare Flexible SSL** — origin serves HTTP only; WebSocket works via Cloudflare proxy
- **trust proxy 1** — required for express-rate-limit behind Caddy/Cloudflare
- **Content-hashed Vite bundles** — cache busting automatic; Cloudflare may need manual purge after deploy

## Contact / Legal
- **Live URL**: https://immerdra.ch
- **Company**: Sünneli GmbH (CHE-442.906.842), St. Gallen
- **Contact**: kontakt@edv.sg | +41 78 649 19 45
- **Impressum**: https://edv.sg/impressum
