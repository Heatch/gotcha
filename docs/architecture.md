# Architecture

## Product boundary

Gotcha will use an Expo/React Native TypeScript application, a Node.js API, and
MySQL 8.4 LTS/InnoDB. This phase supplies schema and documentation only; no
runtime is implemented. The proposed stack (Fastify, Kysely, Socket.IO, Expo
Router, hosting direction) is recorded in [decisions](decisions.md), with the
[API contract](api.md), [realtime events](realtime.md),
[project structure](project-structure.md), [mobile app](mobile-app.md),
[operations](operations.md) and [trust and safety](trust-and-safety.md) plans.

The previous web app and backend have been intentionally removed, including
Firebase/Firestore and deployment configuration. No live cloud service was
modified. Old-game/password migration and backwards compatibility are out of
scope.

## Identity without accounts

A host creates a game and is its first player. Joining uses an unpredictable
game code and a new nickname unique within that game. The future API issues a
separate high-entropy membership secret for each membership. It stores only a
SHA-256 digest of that random secret; the device keeps the usable secret in
Expo-compatible secure storage. Use at least 256 random bits, TLS, constant-time
digest comparison, admission throttling and collision retries. IDs and game
codes are not bearer credentials.

There is no global user/device row, password, or cross-game player linkage. A
device may hold credentials for many games. Losing local data loses access:
there is no account, host transfer, recovery, leave or kick initially.

Private saved packs have independent ownership secrets. Reusing a pack requires
that secret; joining a game does not grant its source pack's ownership. Saved
copies must not retain a link identifying their saver across games.

## Storage boundaries

| Data | Server | Device |
| --- | --- | --- |
| Built-in packs | Durable catalog | Optional cache |
| Explicitly saved private packs | Until owner explicitly deletes | ID, ownership secret, optional cache |
| Unsaved draft, game mission snapshot | Until game expiry | Authorized cache |
| Memberships, private assignments, offers, cooldowns, scores | Temporary authoritative state | Own state plus shared authorized views |
| Chat and roster | Temporary, member-only | Downloaded chat and roster |
| Old-game history | No archive after expiry | Own results/comments, game/pack summary, roster, leaderboard, downloaded chat |
| Other players' open assignments | Owner/API only | Never copied to another player |

Use Expo SQLite for future durable device history and an Expo secure-storage
facility for credentials, not a global login store. Neither is scaffolded now.
Local snapshots should carry schema version, game revision, last-sync time,
and whether final results were received. An incomplete cache must never claim to
be a final leaderboard. Device deletion/history backup UX remains future work.

## Packs

Every game has one isolated draft copied from a built-in/private pack or newly
created by its host. Only the host can read/edit that draft. Start freezes a
separate game mission snapshot and pack/rule metadata. Later edits or deletion
of a source pack cannot change the game.

Hosts may explicitly save a private independent copy of their draft or frozen
pack. Other members may explicitly save the complete frozen pack **after the
game ends**, during its synchronization window. This intentionally reveals all
mission text at that point, not the assignments or other players' private data.
There is no collaboration or public user-created pack discovery. Saving is
never assumed, and the resulting copy has its own owner secret.

## Game settings

Each game owns one `game_settings` row chosen by its host: wallet size, offer
size, rerolls, cooldown curve, target repeat rule, scoring, time limit and
first-to-X target, leaderboard/result-post identity, chat and joining limits.
Defaults reproduce the original game, so "Create game" works without opening
settings. Everything is editable in the lobby; after start only the live subset
can change, and each change is announced in chat. The server validates and
applies every rule; devices only present the choices. See
[game rules](game-rules.md#game-settings).

## Game lifetime

```text
lobby --host starts--> active --host ends / time limit / first to X--> ended --7 days--> purged
  |                     |
  +--30 days inactive---+-------------------------------------------------------------> purged
```

Accepted joins/configuration/gameplay/chat writes update activity and the
30-day abandonment deadline while in lobby/active state. Reads, polling and
reconnections do not. Ended games are read-only except authorized explicit
pack-copy saves; those saves never extend the seven-day deadline.

The future API must reject access on expiry even before physical cleanup.
A future batched cleanup job removes all game-dependent data and its unsaved
draft, but not independent saved copies or built-ins. SQL does not schedule
cleanup itself. Backups/logs need separately defined retention; deleting rows
does not promise instant removal from them.

Offline clients can view cached data only. All mutations need server
confirmation; no offline mutation queue. A disconnected player may miss final
results and post-end pack saving. After purge there is no server recovery.

## Scaling and future backend responsibilities

- Shared tables indexed/scoped by game, bounded payloads, cursor pagination and
  short transactions; no per-game DDL or process-global game cache.
- Parameterized SQL, connection pooling, deadlock-safe retries with stable
  idempotency keys, and authorization on every read/write/subscription.
- Authenticated game rooms and owner-only private events. Realtime transport is
  proposed in [realtime](realtime.md); never rely on one API process
  holding authoritative state.
- Admission, message, pack and request limits; metrics and load tests must be
  designed before launch. Schema alone does not prove scalability.
- Saved packs with lost ownership secrets cannot be recovered or deleted by
  their former owner. Orphan handling/quotas are a future operational decision,
  not an implicit expiry of explicitly saved packs.

See [game rules](game-rules.md), [transaction contracts](database.md#transaction-contracts)
and [mobile wireframes](wireframes/README.md).
