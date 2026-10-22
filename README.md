# Gotcha

An accountless multiplayer mission game, being redesigned for **React Native +
TypeScript + Expo**, a **Node.js** API, and **MySQL 8.4 LTS**.

## Current status

This repository contains the mobile product's **database and documentation
foundation**, not a runnable application. The previous single-game web client,
backend, password-based player list, and hosting integration have been retired.
Legacy source remains on its existing branch; it is not duplicated here.

No mobile app, API, database connection, provisioning, deployment, or cloud
resources are configured. There are no application startup/build commands yet.
Do not run the SQL against an existing database.

## Start here

- [Architecture and scope](docs/architecture.md)
- [Game rules](docs/game-rules.md)
- [Database model, lifecycle, and transaction contracts](docs/database.md)
- [Database diagram (SVG)](docs/database.svg) and [Mermaid source](docs/database.mmd)
- [Initial schema](database/migrations/001_initial.sql)
- [Illustrative catalog seed](database/seeds/001_example_catalog.sql)
- [Project instructions](AGENTS.md)

The schema uses shared game-scoped tables, not a table per game. There are no
accounts or globally identifiable devices: anonymous membership secrets are
different for each game. Active state is temporary server data; old-game history
belongs on each device. Built-in packs and **explicitly saved** private packs are
the only durable server content.

## Validation

Run the dependency-free structural/documentation checks with Node.js 22 or later:

```powershell
node --test tools\foundation.test.mjs
```

These checks **do not execute MySQL** or prove future API behavior. See the
[database validation boundary](docs/database.md#validation) and the documented
[diagram rendering command](docs/database.md#diagram).
