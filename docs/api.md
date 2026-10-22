# API contract

The HTTP API between the mobile app and the Node.js server. It is a design, not
an implementation: nothing here runs yet. The [game rules](game-rules.md) and
[transaction contracts](database.md#transaction-contracts) define behaviour;
this page defines the wire format. Stack choices are in
[decisions](decisions.md).

All request and response bodies are defined once as Zod schemas in
`packages/shared` ([D4](decisions.md#d4-shared-validation)); this page is the
human-readable summary of those schemas.

## Conventions

- **Base path:** `/v1`. JSON only, UTF-8, `Content-Type: application/json`.
- **Envelope:** success is `{ "success": true, "data": ... }`; failure is
  `{ "success": false, "code": "NICKNAME_TAKEN", "message": "..." }` with the
  matching HTTP status. `message` is safe to show; the app chooses its own
  wording by `code`.
- **IDs:** UUID strings ([D14](decisions.md#d14-identifiers)). Times: ISO 8601
  UTC with milliseconds. Every game response includes `serverTime` so the app
  can correct its clock for countdowns.
- **Names:** camelCase in JSON; the server maps to the snake_case columns.
- **Request size:** 256 KB maximum body (a full 500-mission pack fits).
- **Headers sent by the app:**

| Header | Required | Purpose |
| --- | --- | --- |
| `X-Gotcha-App-Version` | Every request | Semantic version; see [versioning](#versioning) |
| `Authorization: Bearer <secret>` | Game and private-pack routes | Membership or pack ownership secret |
| `Idempotency-Key` | Retryable writes marked below | 1-64 ASCII characters, new per user action, reused on retry |

## Authentication

There are no accounts. Two kinds of bearer secret exist, both generated on the
device ([D9](decisions.md#d9-client-generated-secrets)): 32 random bytes,
base64url (43 characters).

- **Membership secret:** one per game membership. Sent on every
  `/v1/games/{gameId}/...` route. The server hashes it with SHA-256, looks up
  `game_players.membership_secret_hash`, and checks that the player belongs to
  `{gameId}`. Mismatches return `404 GAME_NOT_FOUND`, never a hint that the game
  exists.
- **Pack secret:** one per private saved pack. Sent on `/v1/packs/private/...`
  routes and when creating a game from a private pack.

Secrets never appear in URLs, logs, crash reports or receipts. Join codes and
IDs are not credentials.

## Idempotency

Writes that a flaky network may repeat are safe to retry:

- **Create game, join, create or save a pack:** retry-safe because the device
  sends the same secret. If the digest already exists for the same game and
  payload, the server returns the original result with `200` instead of `201`.
- **Claim, reroll, resolve, settings edit, save pack:** require
  `Idempotency-Key`, stored in `mutation_receipts`. A repeat with the same key
  and payload returns the recorded result; a different payload returns
  `409 IDEMPOTENCY_MISMATCH`.
- **Chat:** requires `Idempotency-Key` as well. This needs a
  `client_message_id` column, see
  [planned schema additions](database.md#planned-schema-additions).
- **Start, end, draft edits:** guarded by `expectedRevision`; a repeat after
  success returns `409 REVISION_CONFLICT`, and the app refetches and sees the
  result.

## Endpoints

"Host" means the caller's membership has role `host`. Unless stated, game
routes need a membership in that game and reject expired games with
`410 GAME_EXPIRED`.

### Meta

| Method and path | Auth | Purpose |
| --- | --- | --- |
| `GET /v1/meta` | None | `minAppVersion`, `latestAppVersion`, `serverTime`, `supportEmail`, `termsUrl`, `privacyUrl` |
| `GET /v1/health` | None | Liveness and database check for the host platform; not used by the app |

### Built-in packs

| Method and path | Purpose |
| --- | --- |
| `GET /v1/packs/builtin` | List `{ catalogKey, title, description, missionCount }` |

Mission text of built-in packs is only visible to a host through their game's
draft, so the catalog is not freely scraped.

### Games

| Method and path | Auth | Idempotent by | Purpose |
| --- | --- | --- | --- |
| `POST /v1/games` | None | Secret | Create game: [contract 1](database.md#transaction-contracts) |
| `POST /v1/games/join` | None | Secret | Join by code: contract 2 |
| `GET /v1/games/{gameId}` | Member | Read | Game snapshot for the caller |
| `GET /v1/games/{gameId}/draft` | Host, lobby | Read | Draft pack title, description, missions |
| `PUT /v1/games/{gameId}/draft` | Host, lobby | Revision | Replace draft content: contract 3 |
| `PATCH /v1/games/{gameId}/settings` | Host | Key + revision | Edit settings: contract 4 |
| `POST /v1/games/{gameId}/start` | Host, lobby | Revision | Start: contract 3 |
| `POST /v1/games/{gameId}/end` | Host, active | Revision | End manually: contract 8 |
| `POST /v1/games/{gameId}/slots/{slotNumber}/offer` | Member, active | Read-like | Get or deal the current offer: contract 5 |
| `POST /v1/games/{gameId}/slots/{slotNumber}/reroll` | Member, active | Key | Reroll the current offer |
| `POST /v1/games/{gameId}/slots/{slotNumber}/claim` | Member, active | Key | Claim one offered mission |
| `POST /v1/games/{gameId}/assignments/{assignmentId}/resolve` | Owner, active | Key | Success or failure: contract 6 |
| `GET /v1/games/{gameId}/messages?after={id}&limit={n}` | Member | Read | Chat and system posts, oldest first, `limit` 1-100 (default 50) |
| `POST /v1/games/{gameId}/messages` | Member, active, chat on | Key | Send a chat message: contract 7 |
| `POST /v1/games/{gameId}/pack-copies` | Host any state; others ended | Secret + key | Save the pack privately: contract 9 |

Planned with [trust and safety](trust-and-safety.md) and
[push notifications](mobile-app.md#notifications):

| Method and path | Auth | Purpose |
| --- | --- | --- |
| `POST /v1/games/{gameId}/players/{playerId}/remove` | Host | Remove a player |
| `POST /v1/games/{gameId}/reports` | Member | Report a message, player or mission |
| `PUT /v1/games/{gameId}/me/notifications` | Member | Set or clear push token and chat-notification preference |

### Private packs

| Method and path | Auth | Purpose |
| --- | --- | --- |
| `POST /v1/packs/private` | None (body carries new secret) | Create a pack from scratch (My packs, + New) |
| `GET /v1/packs/private/{packId}` | Pack secret | Full pack |
| `PUT /v1/packs/private/{packId}` | Pack secret | Replace content with `expectedRevision` |
| `DELETE /v1/packs/private/{packId}` | Pack secret | Delete: contract 10 |

## Key payloads

### Create game

```json
{
  "nickname": "Sam",
  "membershipSecret": "<43 chars>",
  "source": { "kind": "builtin", "catalogKey": "example_social" },
  "settings": { "slotCount": 5, "cooldownBaseMinutes": 5 }
}
```

`source` is one of `{ kind: "builtin", catalogKey }`,
`{ kind: "private", packId, packSecret }` or `{ kind: "blank" }`. `settings` is
optional and partial; missing fields take the defaults from
[game settings](game-rules.md#game-settings). Response `201`:
`{ gameId, playerId, joinCode, snapshot }`.

### Join game

`{ code, nickname, membershipSecret }`. Codes are normalized before lookup
(uppercase, spaces and hyphens removed, `O` read as `0`, `I` and `L` as `1`).
Response `201` `{ gameId, playerId, snapshot }`.

### Game snapshot

`GET /v1/games/{gameId}` returns everything one screen needs, filtered for the
caller:

| Field | Contents |
| --- | --- |
| `game` | `id`, `joinCode`, `state`, `title` (frozen pack title once started), `revision`, `startedAt`, `scheduledEndAt`, `endedAt`, `endReason`, `expiresAt` |
| `settings` | All settings plus `revision`; the shared schema marks which are live |
| `roster` | `{ playerId, nickname, role, joinedAt }` for every member |
| `me` | `playerId`, `role`, `score`, `rerollsLeft`, `cooldownLevel`, `slots[]`, `history[]`, target eligibility for the resolve sheet |
| `slots[]` | `{ slotNumber, state: "open" \| "empty" \| "cooldown", assignment?, cooldownEndsAt? }` |
| `leaderboard` | Present unless the mode is off during play: `{ rank, name, score, isMe }[]`. Names follow the mode. After the end: `{ rank, nickname, alias, score, isMe }[]` |
| `winner` | After a first-to-X win: the winner's display name under the current mode |
| `chat` | `enabled`, `resultPosts`, `latestMessageId` |
| `serverTime` | Now, for clock correction |

Never included: other players' open assignments, offers or mission text; other
players' aliases while anonymous (except the caller's own); mission text of the
draft for non-hosts.

### Offer, reroll, claim

- **Offer:** response `{ offerId, revision, missions: [{ gameMissionId, text, allowsGroup }] }`
  with 0 to `offerSize` items. An empty list means the pool is exhausted.
- **Reroll:** same response, plus `rerollsLeft`.
- **Claim:** body `{ offerId, gameMissionId }`. Response: the updated slot.
  `409 MISSION_TAKEN` if someone else claimed it first; the app asks for a new
  offer.

### Resolve

Body `{ outcome: "success" | "failure", target?: { kind: "player", playerId } |
{ kind: "group" }, comment?: string }`. Target is required for success and
forbidden for failure. Comment up to 500 characters, success only. Response:
`{ score, slot, historyEntry, gameEnded }`.

### Messages

Each item: `{ id, kind, createdAt, sender?: { playerId, nickname }, text }`.
For result posts the server renders `text` at read time under the current
leaderboard identity and result-post setting; the app never sees the hidden
identity. Settings-change posts carry the stored text.

## Errors

| HTTP | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_FAILED` | Body or query fails the shared schema. `details` lists field errors |
| 401 | `AUTH_REQUIRED` | Missing or malformed bearer secret |
| 403 | `HOST_ONLY` | Non-host calls a host route |
| 403 | `CHAT_DISABLED` | Player chat is off |
| 403 | `PLAYER_REMOVED` | Planned: the caller was removed by the host |
| 404 | `GAME_NOT_FOUND` | Unknown code or ID, or a secret for another game |
| 404 | `PACK_NOT_FOUND` | Unknown pack or wrong pack secret |
| 409 | `NICKNAME_TAKEN` | Nickname in use in this game |
| 409 | `GAME_FULL` | `max_players` reached |
| 409 | `LATE_JOIN_CLOSED` | Active game with late joining off |
| 409 | `GAME_NOT_ACTIVE` | Gameplay call outside the active state, or editing after start |
| 409 | `REVISION_CONFLICT` | `expectedRevision` is stale; refetch |
| 409 | `SETTING_LOCKED` | Non-live setting changed after start |
| 409 | `COOLDOWN_ACTIVE` | Slot still cooling down; includes `cooldownEndsAt` |
| 409 | `SLOT_NOT_EMPTY` | Offer or claim on a filled slot |
| 409 | `MISSION_TAKEN` | Offered mission claimed by someone else |
| 409 | `OFFER_STALE` | Offer superseded or rerolled |
| 409 | `NO_REROLLS_LEFT` | Reroll allowance used |
| 409 | `ALREADY_RESOLVED` | Assignment already resolved |
| 409 | `IDEMPOTENCY_MISMATCH` | Key reused with a different payload |
| 410 | `GAME_ENDED` | Write to an ended game |
| 410 | `GAME_EXPIRED` | Past `expires_at`, even before cleanup |
| 422 | `TARGET_NOT_ALLOWED` | Self, ineligible under the target rule, or Group on a non-Group mission |
| 422 | `CONTENT_REJECTED` | Word filter rejected a nickname, title or mission |
| 426 | `UPGRADE_REQUIRED` | App older than `minAppVersion` |
| 429 | `RATE_LIMITED` | See [limits](operations.md#rate-limits); `Retry-After` header set |
| 500 | `INTERNAL` | Unexpected; logged with a request ID returned in `X-Request-Id` |
| 503 | `UNAVAILABLE` | Maintenance or database down |

Errors for the same input are stable, so the app can map each code to a
screen: inline field errors (wireframe 04), "That mission was just taken"
(wireframe 08), and so on.

## Versioning

- Routes live under `/v1`. Inside v1 only additive changes: new optional
  fields, new endpoints, new error codes the app treats as generic failures.
- A breaking change ships as `/v2` while `/v1` keeps working until
  `minAppVersion` is raised past every app that uses it.
- The server rejects `X-Gotcha-App-Version` below `MIN_APP_VERSION` with
  `426 UPGRADE_REQUIRED` on every route except `/v1/meta`. The app checks
  `/v1/meta` at launch and shows a blocking update screen.
- JavaScript-only fixes ship through EAS Update; native changes need a store
  release and usually a `minAppVersion` bump only when the API demands it.

## Testing the contract

- Shared Zod schemas are unit-tested with valid and invalid examples.
- Every route has an integration test against a real MySQL 8.4 container
  (Testcontainers), covering the happy path, each error code it can return,
  authorization by the wrong member, and a retry with the same idempotency key.
- The [validation matrix](database.md#validation) lists the behaviours that
  must be proven by these tests rather than by static checks.
