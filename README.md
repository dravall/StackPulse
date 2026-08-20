# StackPulse

An uptime-monitoring service (a BetterUptime/UptimeRobot-style clone): register a website URL, and a background system periodically checks whether it's reachable, recording latency and up/down status from region-aware workers.

This project started as a build my friend and I worked through together, based on a course project structure (see `steps.png` for the original course roadmap). The improvements documented below — security fixes, reliability fixes, test corrections, and this README — are my own follow-up work on top of that base.

## Architecture

A decoupled producer/consumer pipeline built as a Bun + Turborepo monorepo:

- **`apps/pusher`** — runs on an interval, reads every monitored website from Postgres, and pushes `{url, id}` pairs onto a Redis Stream.
- **`apps/worker`** — a consumer-group reader on that stream (`XREADGROUP`); performs an HTTP GET against each URL, times the response, and writes a `website_tick` row (`Up`/`Down`, latency, region) to Postgres. Run multiple instances with different `REGION_ID`/`WORKER_ID` values to simulate multi-region checking.
- **`apps/api`** — Express + JWT-authenticated REST API: `POST /website`, `GET /status/:websiteId`, `POST /user/signup`, `POST /user/signin`.
- **`apps/web`** — Next.js dashboard (not yet built out beyond the default scaffold).
- **`apps/tests`** — `bun:test` + `axios` integration tests that run against a live `apps/api` instance.
- **`packages/store`** — the shared Prisma schema/client (`user`, `website`, `region`, `website_tick`).
- **`packages/redisstream`** — a thin wrapper around Redis Streams (`xAdd`, `xReadGroup`, `xAck`, consumer-group bootstrap).

## Setup

Requires [Bun](https://bun.sh), a running Postgres instance, and a running Redis instance.

```bash
bun install
```

Each app that needs environment variables has a `.env.example` — copy it to `.env` and fill in real values:

```bash
cp packages/store/.env.example packages/store/.env
cp apps/api/.env.example apps/api/.env
cp apps/worker/.env.example apps/worker/.env
cp apps/pusher/.env.example apps/pusher/.env
```

| Var | Used by | Notes |
|---|---|---|
| `DATABASE_URL` | store, api, worker, pusher | Postgres connection string |
| `JWT_SECRET` | api | Signs auth tokens |
| `PORT` | api | Defaults to `3001` |
| `FRONTEND_URL` | api | Used for the CORS allowlist, defaults to `http://localhost:3000` |
| `REGION_ID` | worker | Must match an existing `region` row's id (see below) |
| `WORKER_ID` | worker | Any unique string identifying this worker instance within its consumer group |

Run migrations:

```bash
cd packages/store
bunx prisma migrate dev
```

**Known gap:** the `region` table isn't seeded by any script yet, so you currently have to insert one row by hand (e.g. via Prisma Studio: `bunx prisma studio`) before `REGION_ID` will resolve to anything real. A proper seed script is a planned follow-up.

Then, from separate terminals:

```bash
cd apps/api && bun run index.ts
cd apps/worker && bun run index.ts
cd apps/pusher && bun run index.ts
```

## Tests

Integration tests hit a running `apps/api` instance over real HTTP (not mocked):

```bash
cd apps/tests
bun test
```

## Status

This is a work in progress, not a finished product yet — most notably, there's no alerting/notification system and no real frontend. A full audit of the codebase (`Project-1-Analysis.md`) tracks what's done and what's left.
