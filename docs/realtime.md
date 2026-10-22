# Realtime updates

How players see chat, leaderboard, roster and game-state changes within a
second or two. Choice and alternatives: [D5](decisions.md#d5-live-updates).

## Principles

1. **HTTP is the source of truth.** Every write goes through the
   [API](api.md). Events only tell the app that something changed, and often
   carry the new data to save a request.
2. **Events are sent only after the database commit.** A rolled-back
   transaction never produces an event.
3. **Missing an event is harmless.** On connect, reconnect, app foreground or a
   revision gap, the app refetches the snapshot and any messages after its
   cursor.
4. **Nothing private leaks.** Rooms are per game and per player, and every
   payload is filtered exactly like the matching HTTP response.

## Connection

- Socket.IO at path `/v1/realtime`, WebSocket transport only (no long-polling
  fallback, which needs sticky sessions).
- Handshake `auth`: `{ gameId, membershipSecret, appVersion }`. The server
  checks the membership as the HTTP API does, then joins the socket to rooms
  `game:{gameId}` and `player:{playerId}`. A failed check closes the socket
  with the same error code as HTTP (`GAME_NOT_FOUND`, `UPGRADE_REQUIRED`,
  `PLAYER_REMOVED`).
- One socket per game the app currently has open. The app connects when a game
  screen is focused and disconnects when it leaves or the app goes to the
  background. Push notifications cover the background.
- Clients send nothing over the socket except Socket.IO's own heartbeats.

## Events

Every event payload has `{ gameId, revision }`. `revision` is
`games.revision` after the commit that caused it.

| Event | Room | Payload | Sent when |
| --- | --- | --- | --- |
| `game.changed` | game | `{ reasons[] }` | Join, start, end, settings edit, draft edit, player removed. The app refetches the snapshot |
| `message.created` | game | One rendered message, as in the messages API | Chat, result post or settings post committed |
| `messages.rerender` | game | `{}` | Leaderboard mode or result-post names changed. The app refetches all cached messages, because result posts render names at read time |
| `leaderboard.changed` | game | The leaderboard, rendered as in the snapshot | A score changed and the leaderboard is visible |
| `me.changed` | player | `{ reasons[] }` | The caller's own slots, offers or score changed from another request (for example a second device, or a removal) |
| `game.ended` | game | `{ endReason, endedAt }` | Any ending |

Because result posts are rendered per mode, `message.created` is rendered once
for the game room under the current mode; nothing personal is included.

## Client handling

```text
on connect or reconnect: refetch snapshot, then messages after latest cached id
on event:
  if event.revision <= known revision: ignore (already applied)
  if event.revision > known revision + 1 and the event is not self-contained:
      refetch snapshot (a change was missed)
  else apply the payload and set known revision
```

`message.created` and `leaderboard.changed` are self-contained; the others ask
for a refetch. The app's own writes update its cache from the HTTP response, so
their echo events are ignored by revision.

## Scaling

- **One server instance:** the in-memory Socket.IO adapter is enough.
- **More than one instance:** add the Socket.IO Redis adapter so an event
  emitted by one instance reaches sockets on all of them. No sticky sessions
  are needed with WebSocket-only transport.
- Events are emitted by the request handler after commit. If the process dies
  between commit and emit, the event is lost; the reconnect refetch covers it.
  An outbox table is not needed while that holds.
- Limits: at most 5 sockets per membership, and a per-IP connection rate limit
  (see [operations](operations.md#rate-limits)).

## Testing

- Integration tests connect two members to a test server and assert that a
  chat message, resolve and settings edit produce the right events, and that a
  non-member or a member of another game receives nothing.
- A test drops the socket, writes, reconnects and asserts the refetch path
  shows the write.
