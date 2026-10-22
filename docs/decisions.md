# Decisions

Pre-build decisions for the first version of the mobile app and API. Each entry
records the choice, the alternatives and why. **Proposed** means a recommended
default that has not been confirmed by the product owner yet; build on it, but
it can still change cheaply. **Accepted** means confirmed.

To change a decision, edit its entry, set the status, and update every document
it links to in the same change.

## Summary

| # | Topic | Choice | Status |
| --- | --- | --- | --- |
| D1 | Repository layout | pnpm workspace monorepo | Proposed |
| D2 | Server framework | Fastify + TypeScript on Node.js 22 LTS | Proposed |
| D3 | Database access and migrations | Kysely on mysql2; plain SQL migration files | Proposed |
| D4 | Shared validation | Zod schemas in `packages/shared` | Proposed |
| D5 | Live updates | Socket.IO events + HTTP refetch; writes over HTTP | Proposed |
| D6 | Mobile stack | Expo Router, TanStack Query, Zustand, expo-sqlite, expo-secure-store | Proposed |
| D7 | Background jobs | Check on touch + in-process sweeper with a MySQL lock | Proposed |
| D8 | Hosting direction | Docker container + managed MySQL 8.4; provider later | Proposed |
| D9 | Client-generated secrets | Device creates membership and pack secrets | Proposed |
| D10 | API versioning | `/v1` prefix + app version header + minimum version | Proposed |
| D11 | Push notifications | In v1; local notifications for cooldowns, Expo push for server events | Proposed |
| D12 | Moderation | Report, block on device, word filter, host removes player, manual review | Proposed |
| D13 | Minimum age | 13+ | Proposed |
| D14 | Identifiers | UUIDv7 stored as `BINARY(16)` | Proposed |

## D1 Repository layout

**Choice:** one repository, pnpm workspaces: `apps/mobile`, `apps/server`,
`packages/shared`, with `database/`, `docs/` and `tools/` staying at the root.
See [project structure](project-structure.md).

**Alternatives:** npm workspaces (fine, slower and looser dependency
isolation); separate repositories (API types drift, two pull requests per
feature).

**Why:** the app and server share settings validation, API types and error
codes. One pull request can change the schema, server, app and docs together,
which [AGENTS.md](../AGENTS.md) already expects.

## D2 Server framework

**Choice:** Fastify 5 with TypeScript on Node.js 22 LTS.

**Alternatives:** Express (familiar, but no built-in schema validation or
typed routes); NestJS (heavy for a small API); Hono (good, smaller Node
ecosystem for Socket.IO and plugins).

**Why:** fast, schema-first routes, structured logging (pino) with header
redaction, and a mature plugin set (rate limiting, CORS, Helmet).

## D3 Database access and migrations

**Choice:** Kysely query builder over the `mysql2` driver. Migrations stay as
numbered plain SQL files in [`database/migrations`](../database/migrations),
applied in order by a small runner that records them in a
`schema_migrations` table.

**Alternatives:** Prisma or TypeORM (want to own and generate the schema; the
SQL here uses CHECK constraints, generated columns and composite foreign keys
they model poorly); Drizzle (reasonable, but its migration tooling also wants
to generate SQL); raw `mysql2` (no type safety).

**Why:** the hand-written SQL stays the source of truth. Kysely gives typed
queries and explicit transactions with `SELECT ... FOR UPDATE`, which the
[transaction contracts](database.md#transaction-contracts) need. Database types
are generated from a migrated database (`kysely-codegen`), not hand-written.

## D4 Shared validation

**Choice:** Zod schemas in `packages/shared` for every request and response
body, the game settings (ranges, defaults, which ones are live) and error codes.
The server validates with them; the app uses them for forms and to type
responses.

**Why:** settings rules exist in three places (SQL CHECKs, server, app). One
shared schema plus a test comparing its defaults and ranges with
[`001_initial.sql`](../database/migrations/001_initial.sql) keeps them aligned.

## D5 Live updates

**Choice:** Socket.IO from server to app only. Every write is a normal HTTP
request. Events say what changed; on reconnect or a missed revision, the app
refetches over HTTP. A Redis adapter is added only when more than one server
instance runs. See [realtime](realtime.md).

**Alternatives:** plain WebSockets (`ws`; we would rebuild rooms, reconnects and
heartbeats); server-sent events (one-way is enough, but React Native support
needs a polyfill and some proxies buffer them); polling only (simplest, but
slow chat and high request volume).

**Why:** chat and leaderboard need second-level latency. HTTP stays the only
source of truth, so a lost event never loses data.

## D6 Mobile stack

**Choice:** Expo (current SDK at build time) with Expo Router, TanStack Query
for server data, Zustand only for small cross-screen state, expo-sqlite for
device history, expo-secure-store for secrets, expo-notifications, and EAS
Build and EAS Update. See [mobile app](mobile-app.md).

**Alternatives:** React Navigation directly (Expo Router is built on it and
adds file-based routes and deep links); Redux (more ceremony than needed).

## D7 Background jobs

**Choice:** two layers. Any request that touches a game first applies an
overdue time limit (already required by
[transaction contract 8](database.md#transaction-contracts)). A sweeper loop in
each server process runs every minute, but only the one holding the MySQL
`GET_LOCK('gotcha_sweeper', 0)` lock does work: finalize overdue timed games,
purge expired games, prune dead push tokens. See [operations](operations.md#background-jobs).

**Alternatives:** BullMQ on Redis (more infrastructure for three jobs);
external cron (another deployable and secret).

## D8 Hosting direction

**Choice:** ship the server as one Docker image, deploy it to a host that
supports WebSockets and health checks, with a managed MySQL 8.4 database and
daily backups. Provider decided when we deploy. See [operations](operations.md).

**Why:** keeps options open (Fly.io, Render, Railway, AWS ECS + RDS, Google Cloud
Run + Cloud SQL). Nothing in the code may depend on a specific provider.

## D9 Client-generated secrets

**Choice:** the device generates every bearer secret (game membership and
private pack ownership) with a secure random generator, 32 bytes, base64url,
and sends it once. The server stores only its SHA-256 digest.

**Why:** creating and joining become naturally retry-safe. If the response is
lost, the device retries with the same secret and the server finds the existing
membership by digest instead of creating a second one. This extends the pattern
already used for saving packs ([mutation receipts](database.md#mutation_receipts)).
The secret is generated before the request and saved to secure storage first.

## D10 API versioning

**Choice:** all routes under `/v1`. Every request sends `X-Gotcha-App-Version`.
Below the configured minimum version the server answers `426` with
`UPGRADE_REQUIRED`, and the app shows an update screen. Within `/v1` only
additive changes are allowed. JavaScript-only fixes ship with EAS Update. See
[API](api.md#versioning).

## D11 Push notifications

**Choice:** in v1.

- **Mission ready** (cooldown over) is a **local** notification scheduled by
  the device from the server's cooldown deadline. No server work is needed, and
  running cooldowns never change.
- **Game started, game ended, settings changed and chat** are server pushes via
  the Expo push service, stored per membership, with a per-game chat toggle.

**Why:** without them players have to keep opening the app to notice a free
slot, which is the core loop. Push tokens are stored per membership and deleted
with the game, so they never link games together. This needs a schema
addition, see [planned schema additions](database.md#planned-schema-additions).

## D12 Moderation

**Choice:** report a message, player or custom mission; block a player on your
own device; server word filter; the host can remove a player; reports reviewed
by hand from a support inbox. See [trust and safety](trust-and-safety.md).

**Why:** Apple App Store Review Guideline 1.2 and Google Play's user-generated
content policy require a way to report and block, filtering of objectionable
content and published contact details for apps with chat or user-written
content. Removing a player is a change to the game rules and needs a schema
addition; it is not in the rules until this decision is accepted.

**Alternative:** an automated moderation service (for example the OpenAI
moderation endpoint). Possible later; it sends chat text to a third party, which
the privacy policy would have to state.

## D13 Minimum age

**Choice:** 13+ in the terms of use, with a first-launch confirmation. Expected
store ratings: Apple 12+ and Google Play Teen, mainly for unrestricted chat and
user-written missions; the final rating comes from the store questionnaires.

**Why:** avoids the extra requirements for children's apps (COPPA, Google
Families, Apple Kids category) while matching a party game audience. Built-in
packs must stay suitable for 13+.

## D14 Identifiers

**Choice:** UUIDv7 generated by the server (time-ordered, good for InnoDB
indexes), stored as `BINARY(16)`, sent as lowercase hyphenated strings. Message
IDs stay `BIGINT` cursors. Join codes are 8 characters from the Crockford base32
alphabet (no I, L, O or U), shown as two groups of four, giving about 2^40
codes.

## Open questions

These do not block the first build steps, but need an answer before launch.

1. Confirm or change each **Proposed** decision above.
2. App name and store listing: is "Gotcha" available on both stores?
3. Who reviews reports, and what is the support email address?
4. Which built-in packs ship in v1, and who writes and reviews them? The example
   seed is illustrative only.
5. Expected launch size (concurrent games and players) to set the load targets
   in [operations](operations.md#capacity-targets).
6. Should a removed player's open missions return to the pool or stay used up?
   The proposal in [trust and safety](trust-and-safety.md#host-removes-a-player)
   returns them.
7. Is anonymous crash reporting (Sentry) acceptable, given the privacy promise?
   Proposed: yes, with no game content or secrets in reports.
