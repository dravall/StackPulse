# StackPulse

An uptime-monitoring service (a BetterUptime/UptimeRobot-style clone): register a website URL, and a background system periodically checks whether it's reachable, recording latency and up/down status from region-aware workers.

This project is built on an unmodified reference implementation from a course project structure (see `steps.png` for the original course roadmap). Everything documented below — the security fixes, reliability fixes, test corrections, and this README — is my own follow-up work on top of that base.

## Architecture

A decoupled producer/consumer pipeline built as a Bun + Turborepo monorepo:

- **`apps/pusher`** — runs on an interval, reads every monitored website from Postgres, and pushes `{url, id}` pairs onto a Redis Stream.
- **`apps/worker`** — a consumer-group reader on that stream (`XREADGROUP`); performs an HTTP GET against each URL, times the response, and writes a `website_tick` row (`Up`/`Down`/`Unknown`, latency, region) to Postgres. Run multiple instances with different `REGION_SLUG`/`WORKER_ID` values to simulate multi-region checking.
- **`apps/api`** — Express + JWT-authenticated REST API: `POST /website`, `GET /websites`, `GET /status/:websiteId`, `PATCH /website/:id`, `DELETE /website/:id`, `POST /user/signup`, `POST /user/signin`.
- **`apps/web`** — Next.js dashboard: sign in/up, a live sites table (status, response time, last check), add/edit/delete, all talking to `apps/api` directly from the client.
- **`apps/tests`** — `bun:test` + `axios` integration tests that run against a live `apps/api` instance.
- **`packages/store`** — the shared Prisma schema/client (`user`, `website`, `region`, `website_tick`).
- **`packages/redisstream`** — a thin wrapper around Redis Streams (`xAdd`, `xReadGroup`, `xAck`, consumer-group bootstrap).

## Setup

Requires [Bun](https://bun.sh), a running Postgres instance, and a running Redis instance. `docker-compose.yml` provides both:

```bash
docker compose up -d
bun install
```

Each app that needs environment variables has a `.env.example` — copy it to `.env` and fill in real values:

```bash
cp packages/store/.env.example packages/store/.env
cp apps/api/.env.example apps/api/.env
cp apps/worker/.env.example apps/worker/.env
cp apps/pusher/.env.example apps/pusher/.env
cp apps/web/.env.example apps/web/.env
```

| Var | Used by | Notes |
|---|---|---|
| `DATABASE_URL` | store, api, worker, pusher | Postgres connection string |
| `JWT_SECRET` | api | Signs auth tokens |
| `PORT` | api | Defaults to `3001` |
| `FRONTEND_URL` | api | Used for the CORS allowlist, defaults to `http://localhost:3000` |
| `REGION_SLUG` | worker | A region's `name` (e.g. `us-east`) — must exist in the `region` table (see seeding below) |
| `WORKER_ID` | worker | Any unique string identifying this worker instance within its consumer group |
| `NEXT_PUBLIC_API_URL` | web | Where the dashboard reaches `apps/api`, defaults to `http://localhost:3001` |

Run migrations and seed the fixed set of regions (`us-east`, `eu-west`, `ap-south`):

```bash
cd packages/store
bunx prisma migrate dev
bunx prisma db seed
```

Then, from separate terminals:

```bash
cd apps/api && bun run index.ts
cd apps/worker && bun run index.ts
cd apps/pusher && bun run index.ts
cd apps/web && bun dev
```

## Tests

Integration tests hit a running `apps/api` instance over real HTTP (not mocked):

```bash
cd apps/tests
bun test
```

## Status

This is a work in progress, not a finished product yet — most notably, there's no alerting/notification system, and the dashboard only shows each site's latest check (no history/charts, since the API doesn't expose that yet).
