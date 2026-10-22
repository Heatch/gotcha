# Project structure and tooling

Planned layout and tooling for the first build. Nothing below is scaffolded
yet. Choices and alternatives: [D1-D4](decisions.md).

## Layout

```text
gotcha/
  apps/
    mobile/              Expo app (Expo Router)
      app/               routes, one file per screen; see mobile-app.md
      src/
        api/             typed API client, TanStack Query hooks, socket client
        device/          SQLite history, secure storage, notifications
        features/        screens' components grouped by feature (wallet, chat, ...)
        ui/              shared components and theme tokens
    server/              Fastify API
      src/
        routes/          one file per resource (games, packs, messages, ...)
        services/        transaction contracts, one function per contract
        db/              Kysely instance, generated types, transaction helpers
        realtime/        Socket.IO setup, rooms, event emitters
        jobs/            sweeper (timed ends, purge, push receipts)
        push/            Expo push sender
        moderation/      word filter, reports
      test/              integration tests (Testcontainers MySQL)
  packages/
    shared/              Zod schemas, API types, error codes, settings defaults
  database/
    migrations/          numbered SQL, applied in order (unchanged location)
    seeds/               catalog seeds
  docs/                  this documentation
  tools/                 repository scripts (wireframes, foundation tests)
  package.json           workspace root scripts
  pnpm-workspace.yaml
```

Rules:

- `packages/shared` has no React Native, Node or database imports, so both
  apps can use it.
- The app never imports from `apps/server`, and the server never imports from
  `apps/mobile`.
- Each transaction contract in [database.md](database.md#transaction-contracts)
  becomes one service function with one integration test file.

## Tooling

| Concern | Tool |
| --- | --- |
| Package manager | pnpm (version pinned in `packageManager`) |
| Runtime | Node.js 22 LTS (pinned in `.nvmrc` and `engines`) |
| Language | TypeScript, `strict: true`, `noUncheckedIndexedAccess: true` |
| Lint and format | ESLint with typescript-eslint, Prettier |
| Server and shared tests | Vitest |
| Database tests | Vitest + Testcontainers running `mysql:8.4` |
| Mobile tests | Jest with `jest-expo` and React Native Testing Library |
| Mobile end-to-end | Maestro flows for create, join, play and end (after the first build) |
| API load tests | k6 scripts in `apps/server/load` |
| Database types | `kysely-codegen` against a freshly migrated database |
| Builds and releases | EAS Build, EAS Submit, EAS Update |

Root scripts (planned): `pnpm lint`, `pnpm typecheck`, `pnpm test`,
`pnpm test:db`, `pnpm db:migrate`, `pnpm db:seed`, `pnpm dev:server`,
`pnpm dev:mobile`. They do not exist yet; do not document them as runnable
until they do.

## Migrations

- Files in `database/migrations` are named `NNN_description.sql` and applied
  in order by a small runner in `apps/server/src/db/migrate.ts`. It records
  each file's name and SHA-256 in a `schema_migrations` table and refuses to
  run if an applied file has changed.
- A migration is never edited after it has been applied to a shared
  environment. `001_initial.sql` has not been, so it may still change until the
  first deployment.
- The [database-change skill](../.github/skills/database-change/SKILL.md)
  still applies: SQL, dictionary, ERD and tests change together.

## Local development

- `docker compose up` (planned) starts MySQL 8.4 with the migrations and the
  example seed applied.
- The server reads configuration from environment variables (see
  [operations](operations.md#configuration)); a checked-in `.env.example`
  documents them with dummy values. Real `.env` files are git-ignored.
- The app reads the API URL from `EXPO_PUBLIC_API_URL`. On a physical phone
  this is the computer's LAN address.

## Continuous integration

GitHub Actions on every pull request:

1. Install with pnpm (cached).
2. `node --test tools/foundation.test.mjs`
3. Lint, typecheck, unit tests for all workspaces.
4. Database integration tests against a `mysql:8.4` service container,
   including applying every migration to an empty database.
5. Check that the generated wireframes and ERD are up to date (regenerate and
   fail on a diff).

On merge to the main branch: build the server image and deploy to staging.
Production deploys and store releases are manual.

## Build order

A suggested order that produces something playable early:

1. Workspace, shared settings schema (with the SQL-defaults test), migration
   runner, CI.
2. Server: create, join, snapshot, start; then offer, claim, resolve; then
   chat, end, settings edits.
3. Mobile: home, create, join, lobby, wallet, offer, resolve against the real
   server.
4. Realtime events, leaderboard, chat screens.
5. Device history, ended screen, pack saving, My packs.
6. Push and local notifications, sweeper jobs.
7. Moderation (report, block, remove, filter), terms and privacy screens.
8. Load tests, staging soak, store submission.
