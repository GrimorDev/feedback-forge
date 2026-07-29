# Feedback Forge

Micro-SaaS MVP for aggregating community feedback, triage, public roadmap voting, and a future payment layer.

## Run

```bash
npm install
npm run dev
```

Open the Vite URL printed by the dev server.

## Backend API

```bash
npm install
npm run db:generate
npm run dev:api
```

The API listens on `http://127.0.0.1:3000` during local Node development. Use `ADMIN_API_KEY` for admin routes in production.

## Docker / Portainer

1. Copy `.env.docker.example` values into the Portainer stack environment.
2. Change `POSTGRES_PASSWORD` and `ADMIN_API_KEY`.
3. For Discord OAuth, set `PUBLIC_BASE_URL`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI`, and `ADMIN_DISCORD_IDS`.
4. Deploy the stack from `docker-compose.yml`.

The app is exposed on `API_PORT` (`3010` by default in Docker) and serves both:

- API: `/api/v1/...`
- frontend build: `/`
- public board: `/board`
- private admin panel: `/admin`

Optional seed after first deploy:

```bash
docker compose --profile seed up seed
```

Useful checks:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/api/v1/projects/orbit-chat/board
```

For the default Docker port:

```bash
curl http://localhost:3010/health
```

## Discord OAuth

Create a Discord application and add this redirect URL:

```text
https://your-domain.example/api/v1/auth/discord/callback
```

Then set:

```bash
PUBLIC_BASE_URL=https://your-domain.example
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
DISCORD_REDIRECT_URI=https://your-domain.example/api/v1/auth/discord/callback
ADMIN_DISCORD_IDS=your_discord_user_id
```

`ADMIN_API_KEY` remains available as an emergency/admin bootstrap path.

## Discord Bot

The bot registers `/suggest` and sends feedback to the API.

```bash
DISCORD_BOT_TOKEN=...
DISCORD_CLIENT_ID=...
DISCORD_GUILD_ID=...
API_BASE_URL=https://your-domain.example
PROJECT_SLUG=orbit-chat
npm run bot:discord
```

## What is included

- Fast React admin panel with Kanban triage.
- Public roadmap with one-click voting and a lightweight submission form.
- Offline-first local persistence through `localStorage`.
- Feedback loop event creation when an item moves to `COMPLETED`.
- Prisma schema for Postgres with users, projects, feedback, votes, comments, integrations, notifications, and subscriptions.
- `ENABLE_PAYMENTS=false` by default for early-adopter access.

## Next backend steps

1. Add Prisma Client and route handlers for the contract in `docs/api.md`.
2. Move local UI mutations into API calls with optimistic updates.
3. Add Discord OAuth plus `/suggest` webhook verification.
4. Add Stripe or Lemon Squeezy webhook handlers behind the payment feature flag.
