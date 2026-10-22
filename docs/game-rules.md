# Game rules

## Joining and lifecycle

- Host is also a player and manually starts the game.
- Join lobby games by code, and active games too unless the host turned off
  joining after start. Joins beyond the max players setting are rejected.
  Choose a nickname once per membership:
  unique case-insensitively in that game, fixed after joining.
- No leave, kick, host transfer or recovery initially. Games end when the host
  ends them, or automatically by the optional time limit or score target.
- Only the host creates/edits the single game pack, in the lobby. Starting
  freezes the pack. Other players cannot read the full pack during play.

## Game settings

Every rule below is a per-game setting chosen by the host when creating the
game. Defaults reproduce the original game. Settings are editable in the lobby;
starting freezes them except those marked **live**, which the host may change
during play. A live change applies from that moment on, is announced to
everyone as a system chat post, and never rewrites past results or running
cooldowns.

| Group | Setting | Options | Default | Live |
| --- | --- | --- | --- | --- |
| Wallet | Slots (missions held at once) | 1-10 | 5 | No |
| Wallet | Missions per offer | 1-3 | 2 | No |
| Wallet | Rerolls per player | 0-10 | 0 | No |
| Cooldown | Base time | 0 (off) to 24 h | 5 min | Yes |
| Cooldown | Scaling | Fixed, multiply, add | Multiply | Yes |
| Cooldown | Multiplier (multiply) | x1.1 to x5 | x2 | Yes |
| Cooldown | Step (add) | 1 min to 24 h | 5 min | Yes |
| Cooldown | Cap | None, or 1 min to 7 days | 6 h | Yes |
| Cooldown | Failures advance cooldown | On, off | On | Yes |
| Targets | Repeat rule | Cycle everyone, X different (blocks), X different (sliding), no restriction | Cycle everyone | No |
| Scoring | Failure points | 0, -1 | 0 | No |
| Scoring | Allow negative score (with -1) | On, off | Off (floor at 0) | No |
| Ending | Time limit | None, 10 min to 30 days | None | Yes |
| Ending | First to X score | None, 1-999 | None | Yes |
| Ending | Reaching X ends the game | On, off | On | Yes |
| Leaderboard | Mode | Off, anonymous, nicknames | Anonymous | Yes |
| Chat | Player chat | On, off | On | Yes |
| Chat | Result posts | Full mission, generic, off | Full mission | No |
| Chat | Names in result posts when leaderboard is off | Aliases, nicknames | Aliases | Yes |
| Joining | Allow joining after start | On, off | On | Yes |
| Joining | Max players | Unlimited, 2-200 | Unlimited | Yes |

Settings validation belongs to the server; the device only presents choices.
There is no "unlock more slots" rule: a player's slot count is fixed for the
game.

## Missions and slots

Each player has the configured number of slots. Fill each empty eligible slot
by choosing one of up to *missions per offer* random unassigned missions.
Initial selection and refill use the same atomic claim rules. Offers do not
reserve missions: another player can claim one first, in which case refresh
the offer without losing a slot.

A **reroll** discards the current offer and deals a new one. Discarded missions
return to the pool and are excluded from the new offer when other missions are
available. Each reroll uses one of the player's per-game rerolls.

Each game mission can be assigned **once total**, even after success/failure.
Other games have independent copies. If fewer missions remain than the offer
size, offer what remains; if none remain, show pool exhaustion. Allow partially
filled hands and mid-game joins even when few missions remain. Do not invent
placeholder missions or reject a valid join for insufficient remaining missions.

Secret missions ask players to get others to do something without revealing the
mission. Success/failure is self-reported on an honour system. Resolutions
cannot be undone. A success names another participant, or Group when the
mission is marked **Group OK** in the pack, and may include a comment. Failure
has no target or comment. Both go into the player's wallet.

## Cooldowns

Resolving a mission frees its slot and starts that slot's cooldown. Several
slots can be cooling down at once. The delay depends on the player's
**cooldown level**, not on the slot: each counted resolution moves the player to
the next cooldown time, whichever slot it came from.

```text
fixed:    minutes = base
multiply: minutes = base * multiplier ^ level
add:      minutes = base + step * level
then:     minutes = min(minutes, cap or 10080)
default:  5, 10, 20, 40, 80, 160, 320, 360, 360, ...
```

Calculate the delay from the current level, then increment the level by one.
Failures increment it only when *failures advance cooldown* is on. A base of 0
turns cooldowns off; the level still advances so a later live change has a
consistent history. Clamp before exponentiation to avoid overflow. The server
sets deadlines with its own clock and rejects early refill. An untouched initial
slot is immediately eligible. Live cooldown edits affect cooldowns started after
the edit only.

## Targets

You can never target yourself. Repeat rules for individual successes:

- **Cycle everyone** (default): target every other current participant once
  before repeating anyone; then a new cycle starts.
- **X different, blocks**: hit X different people (or everyone, if fewer), then
  the list resets. Cycle everyone is this rule with X = everyone.
- **X different, sliding**: you cannot target anyone among your last X
  individual targets (X is capped at participants minus one).
- **No restriction**: anyone except yourself.

New arrivals join the current eligibility set. Group is allowed only for Group
OK missions and never advances or resets individual cycles. Use player IDs, not
display names, for enforcement.

## Scoring and ending

Score = completed missions plus *failure points* for each failure. With -1
failure points and negative scores off, a score never drops below 0. The
leaderboard ranks by score; ties share a rank.

The host can always end the game manually. Optional automatic endings:

- **Time limit**: the game ends at the scheduled time (start + limit). The
  host may move or add the time during play; it must stay in the future.
- **First to X**: X is a score, so it follows the scoring rules. The first
  player to reach it is recorded as the winner. If *reaching X ends the game*
  is on (default) the game ends immediately; otherwise play continues until
  the host or time limit ends it. Lowering X during play to or below a
  current score has the same effect at once; the winner is the highest score,
  ties going to whoever reached it first.

The game end reason (host, time limit, score target) is shown to everyone.

## Shared views and secrets

- Leaderboard **anonymous** mode uses random game-local aliases, distinct from
  roster/chat nicknames. It is pseudonymous display, not guaranteed
  unidentifiability. **Nicknames** mode shows nicknames. **Off** hides the
  leaderboard during play.
- After the game ends, the full leaderboard is always revealed with nicknames
  (and which alias belonged to whom), whatever the mode.
- Member-only chat shows player messages, system result posts and settings
  change posts. Player messages always show nicknames.
- Result posts name the actor and target using the leaderboard identity: aliases
  in anonymous mode, nicknames in nicknames mode, and the separate
  *names in result posts* setting when the leaderboard is off. After the end,
  they show nicknames. Result text is rendered when read, so mode changes apply
  to earlier posts too. Switching to nicknames during play cannot be undone on
  devices that already loaded them; warn the host.
- *Full* result posts reveal the resolved mission text; *generic* posts say only
  that someone completed or failed a mission; *off* posts nothing.
- With player chat off, the chat becomes a read-only activity feed when result
  posts are on, and is hidden when result posts are off too.
- A post never reveals anybody's open missions. There is no private-message
  feature or public game feed.
- Offline access is cached read-only.

## Ending, history, and saving packs

Ending stops gameplay/chat writes and starts a seven-day read-only sync window,
with an exception for authorized explicit pack saving. Games abandoned in lobby
or play expire after 30 days without accepted activity.

Each device retains its own mission/results/comments, game/pack summary, roster,
final leaderboard if downloaded, and downloaded chat. Other players' assignments
are not exported. Missing final data remains marked incomplete.

Host may explicitly save an independent private pack for reuse. Other members
may save the complete pack only after the game ends and before expiry. That
choice reveals its full mission list, not other players' assignments. Saved
packs persist until their owner deletes them; unsaved game packs do not.
