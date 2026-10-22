# Operations

How the server runs: environments, configuration, background jobs, abuse
limits, monitoring, backups and capacity. Nothing is deployed yet. Choices:
[D7](decisions.md#d7-background-jobs), [D8](decisions.md#d8-hosting-direction).

## Environments

| Environment | Purpose | Database |
| --- | --- | --- |
| Local | Development | MySQL 8.4 in Docker, example seed |
| Test (CI) | Automated tests | Throwaway MySQL 8.4 container per run |
| Staging | Pre-release checks, internal play-tests, EAS preview builds | Managed MySQL 8.4, built-in packs only |
| Production | Store builds | Managed MySQL 8.4, daily backups |

Staging and production never share a database, secrets or push credentials.

## Hosting requirements

Whichever provider is chosen must give:

- **MySQL 8.4 LTS** (at least 8.0.16; older versions parse but ignore CHECK
  constraints) with InnoDB, `utf8mb4`, UTC time zone, TLS connections and
  automated daily backups.
- Container hosting with WebSocket support, health checks, zero-downtime
  rolling deploys and secrets as environment variables.
- HTTPS with a managed certificate on the API domain.
- Redis (managed) only once there is more than one server instance.
- A region close to most players; one region at first.

## Configuration

Environment variables, documented in `apps/server/.env.example`:

| Variable | Example | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `mysql://gotcha:...@host:3306/gotcha?ssl=true` | Connection string |
| `DATABASE_POOL_SIZE` | `10` | Connections per instance |
| `REDIS_URL` | (empty) | Enables the Socket.IO Redis adapter and shared rate limits |
| `PORT` | `8080` | HTTP and WebSocket port |
| `MIN_APP_VERSION` | `1.0.0` | Older apps get `426 UPGRADE_REQUIRED` |
| `LATEST_APP_VERSION` | `1.0.3` | Lets the app suggest an optional update |
| `EXPO_ACCESS_TOKEN` | secret | Expo push service |
| `SUPPORT_EMAIL` | `support@...` | Shown in the app and used for report alerts |
| `REPORT_ALERT_WEBHOOK` | secret URL | Optional: notify reviewers of new reports |
| `SENTRY_DSN` | secret | Error reporting (if accepted, see [open questions](decisions.md#open-questions)) |
| `LOG_LEVEL` | `info` | |
| `SWEEPER_INTERVAL_SECONDS` | `60` | |

No secret is committed. The server refuses to start if a required variable is
missing.

## Background jobs

A sweeper loop runs in every server instance every `SWEEPER_INTERVAL_SECONDS`.
Each run takes `GET_LOCK('gotcha_sweeper', 0)` on a dedicated connection; if
another instance holds it, the run is skipped. Each task works in small batches
so no transaction is long.

| Task | Selects by | Batch | Action |
| --- | --- | --- | --- |
| Finalize timed games | `ix_game_scheduled_end (state, scheduled_end_at, id)`, active and past due | 100 games | [Contract 8](database.md#transaction-contracts) with `time_limit`, then `game.ended` event and push |
| Purge expired games | `ix_game_expiry (state, expires_at, id)`, past due | 20 games, one transaction each | [Cleanup order](database.md#cleanup-order) |
| Check push receipts | Expo receipt IDs from the last run | 1000 | Clear tokens reported `DeviceNotRegistered` |
| Purge old reports | Planned `content_reports.created_at` older than 90 days | 500 | Delete |

Requests also finalize overdue games when they touch them, so a slow sweeper
never lets play continue past the time limit. Each task logs counts and
duration, and a task that fails is retried on the next run.

## Rate limits

Enforced by `@fastify/rate-limit`; in memory with one instance, Redis-backed
with more. Limits are per IP unless stated, and return `429 RATE_LIMITED` with
`Retry-After`.

| Action | Limit | Why |
| --- | --- | --- |
| Join attempts | 10 per minute, 50 per hour | Stops code guessing (about 2^40 codes) |
| Create game | 10 per hour | Spam games |
| Create or save pack | 20 per hour | Storage abuse |
| Chat messages | 10 per 10 seconds per membership | Flooding |
| Reports | 10 per hour per membership | Report spam |
| Other gameplay writes | 60 per minute per membership | Bugs and scripts |
| Reads | 300 per minute per membership | Tight polling loops |
| Socket connections | 20 per minute; 5 open per membership | Reconnect storms |

Size limits (also validated by the shared schemas): nickname 32 characters,
chat message 2,000, comment 500, mission 1,000, pack title 120, description
2,000, missions per pack 500, players per game 200. Many platforms place
several users behind one IP (schools, mobile carriers), so IP limits are
generous and the per-membership limits do the fine-grained work.

## Logging and monitoring

- Structured JSON logs (pino). The `Authorization` header, request bodies of
  secret-bearing routes and push tokens are redacted. Chat and mission text are
  not logged.
- Every response carries `X-Request-Id`; errors log it with the route, status
  and duration.
- Metrics: request rate, latency and errors by route; database pool use and
  transaction retries (deadlocks); open sockets; sweeper backlog; push failures.
- Alerts: error rate above 2% for 5 minutes, p95 latency above 1 second, the
  database unreachable, sweeper not completing for 10 minutes.
- Log retention 14 days. IP addresses appear only in logs and rate-limit
  counters.

## Backups and recovery

- Daily automated backups of the managed database, kept **7 days**, plus
  point-in-time recovery inside that window. The short retention matches the
  privacy promise: deleted game data is gone from backups within 7 days.
- Restore is tested on staging before launch and then each quarter.
- After a restore, games may move back in time; clients refetch and the
  revision check stops stale writes.

## Capacity targets

Proposed launch targets, to be confirmed ([open questions](decisions.md#open-questions)):

| Measure | Target |
| --- | --- |
| Concurrent active games | 1,000 |
| Players per game | Typical 5-30, maximum 200 |
| Open sockets | 20,000 |
| Write latency (p95) | Under 300 ms |
| Read latency (p95) | Under 150 ms |
| Event delivery after commit (p95) | Under 1 second |

Before launch a k6 test runs these numbers against staging, including 200
players in one game resolving at the same time, to check that game-level row
locking does not become a queue. The schema alone does not prove capacity
([architecture](architecture.md#scaling-and-future-backend-responsibilities)).

## Release process

1. Merge to main deploys the server to staging.
2. Apply new migrations to staging, run the smoke test, play-test with an EAS
   preview build.
3. Production: apply migrations first (they must be backwards compatible with
   the running server), then roll out the server, then release the app.
4. App releases: EAS Build, then store review. JavaScript-only fixes by EAS
   Update to the matching runtime version.
