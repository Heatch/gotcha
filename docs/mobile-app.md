# Mobile app

Planned structure of the Expo app: routes, state, what is stored on the
device, offline behaviour and notifications. Choices: [D6](decisions.md#d6-mobile-stack),
[D11](decisions.md#d11-push-notifications). Screens: [wireframes](wireframes/README.md).

## Routes

Expo Router, file-based. Game screens share one route per game and switch on
the game state, so a lobby becomes the wallet without navigating.

| Route | Wireframe | Notes |
| --- | --- | --- |
| `/` | 01 Home | Reads device history; refreshes active games on focus |
| `/create` | 02 Create game | Holds the draft source and settings locally until "Create game" |
| `/create/settings` and `/create/settings/[group]` | 14-18 | Same components as in-game settings, writing to local state |
| `/pack-editor?target=...` | 03 Pack editor | Target is the game draft or a private pack |
| `/join` | 04 Join game | Accepts `?code=` from a shared link |
| `/game/[gameId]` | 05 Lobby, 06 Wallet, 12 Game ended | Chosen by `game.state` |
| `/game/[gameId]/offer/[slot]` | 08 Mission offer | |
| `/game/[gameId]/resolve/[assignmentId]` | 07 Resolve | Modal sheet |
| `/game/[gameId]/board` | 09 Leaderboard | Modal sheet |
| `/game/[gameId]/chat` | 10 Chat | Modal sheet |
| `/game/[gameId]/settings` and `/game/[gameId]/settings/[group]` | 14-18 | Editable for the host, read-only for players |
| `/rules?gameId=` | 11 How to play | Fills in the game's values when `gameId` is given |
| `/packs` | 13 My packs | |
| `/welcome` | Not drawn yet | First launch: age confirmation and terms |
| `/update-required` | Not drawn yet | Shown on `426 UPGRADE_REQUIRED` |

Deep link: `gotcha://join?code=K7Q2M9XA` and the matching universal link on
the marketing domain open `/join` with the code filled in. The lobby Share
button sends that link.

### Screens still to wireframe

- First launch: confirm 13+, accept the terms, link to the privacy policy.
- Update required.
- Report sheet (message, player or mission) and block confirmation.
- Host remove-player confirmation (from the lobby roster or the wallet menu).
- Notification settings per game (chat on or off) and the system permission
  prompt explanation.

## State

| Kind | Where | Examples |
| --- | --- | --- |
| Server data | TanStack Query cache, keyed by game ID and revision | Snapshot, messages, offers |
| Live events | Socket client updating the Query cache | `message.created`, `leaderboard.changed` |
| Device history | SQLite, read through small repository functions | Past games, cached messages |
| Secrets | Secure storage only | Membership and pack secrets |
| Small UI state | Component state; Zustand only when shared across screens | Create-game draft and settings |

The app never computes rules itself (eligibility, cooldowns, scores). It shows
what the server returns and uses the shared Zod schemas only to validate forms
before sending.

## Device storage

### Secure storage

`expo-secure-store` (Keychain on iOS, Keystore-backed on Android):

| Key | Value |
| --- | --- |
| `membership.{gameId}` | Membership secret |
| `pack.{packId}` | Pack ownership secret |
| `pending.{requestId}` | Secret for a create, join or pack save that has not been confirmed yet |

The secret is written **before** the request is sent, so a crash or lost
response can retry with the same secret ([D9](decisions.md#d9-client-generated-secrets)).
Pending entries older than a day with no confirmed result are deleted.

### SQLite

`expo-sqlite`, schema versioned with `PRAGMA user_version` and forward-only
migrations in the app.

| Table | Columns (main) | Purpose |
| --- | --- | --- |
| `games` | `game_id`, `join_code`, `title`, `my_player_id`, `my_nickname`, `role`, `state`, `joined_at`, `ended_at`, `expires_at`, `last_revision`, `last_synced_at`, `final_received`, `snapshot_json` | Home list and offline view |
| `messages` | `game_id`, `message_id`, `kind`, `sender_nickname`, `text`, `created_at` | Downloaded chat, for history after purge |
| `my_results` | `game_id`, `assignment_id`, `mission_text`, `outcome`, `target_label`, `comment`, `resolved_at` | Own wallet history kept forever |
| `packs` | `pack_id`, `title`, `mission_count`, `saved_at`, `cached_json` | My packs list |

Rules from [architecture](architecture.md#storage-boundaries): snapshots carry
the revision and sync time; a game is only shown as final when
`final_received` is true, otherwise Home shows "Incomplete".

### Device-only actions

- **Remove from this device:** deletes the game's rows and secret. The server
  copy still expires on its own schedule.
- **Block a player:** stored in a `blocked_players (game_id, player_id)` table;
  their chat messages are hidden in that game. See
  [trust and safety](trust-and-safety.md#block).
- No cloud backup of history. Exclude the SQLite file and secure storage from
  Android auto backup so a restored phone does not reuse old secrets
  unexpectedly.

## Offline

- Without a connection the app shows cached data read-only with a banner and
  "last updated" time. All buttons that write are disabled.
- No write is queued for later ([architecture](architecture.md#game-lifetime)).
  A failed write shows an inline error with Retry; Retry resends the same
  idempotency key or secret.
- On reconnect: refetch the snapshot and messages for the open game; refresh
  the Home list in the background.

## Notifications

`expo-notifications`. Permission is requested the first time the player is in
a game that has started, with an explanation screen first; refusing is fine.

| Notification | Type | Trigger |
| --- | --- | --- |
| Mission ready | Local | Scheduled for each slot's `cooldownEndsAt` from the snapshot; rescheduled on every snapshot, cancelled when the game ends |
| Game started | Server push | Host starts the game |
| Game ending soon | Local | 10 minutes before `scheduledEndAt`, if set |
| Game ended | Server push | Any ending |
| Settings changed | Server push | Live settings edit |
| Chat message | Server push | New chat or result post, if chat notifications are on for that game (default on); grouped per game |

Server pushes go through the Expo push service. The token is sent per
membership with `PUT /v1/games/{gameId}/me/notifications`, so the server never
links games through it; it is deleted with the game. Pushes contain no mission
text: "Lee sent a message in Friday party", not the message itself, because
lock screens are visible to others.

## Theming and accessibility

Light and dark themes from central tokens ([AGENTS.md](../AGENTS.md)). All
controls have accessible labels; countdowns are announced at most once a
minute. Minimum touch target 44 points. Dynamic type supported up to the
largest accessibility size on the wallet and chat.
