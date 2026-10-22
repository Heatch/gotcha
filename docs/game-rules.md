# Game rules

## Joining and lifecycle

- Host is also a player and manually starts/ends the game.
- Join lobby or active games by code. Choose a nickname once per membership:
  unique case-insensitively in that game, fixed after joining.
- No automatic win threshold, leave, kick, host transfer or recovery initially.
- Only the host creates/edits the single game pack, in the lobby. Starting
  freezes the pack. Other players cannot read the full pack during play.

## Missions and slots

Each player has five slots. Fill each empty eligible slot by choosing one of
up to two random unassigned missions. Initial selection and refill use the same
atomic claim rules. Offers do not reserve missions: another player can claim
one first, in which case refresh the offer without losing a slot.

Each game mission can be assigned **once total**, even after success/failure.
Other games have independent copies. If only one mission remains, offer it; if
none remain, show pool exhaustion. Allow partially filled hands and mid-game
joins even when fewer than five missions remain. Do not invent placeholder
missions or reject a valid join for insufficient remaining missions.

Secret missions ask players to get others to do something without revealing the
mission. Success/failure is self-reported on an honour system. Resolutions
cannot be undone. A success names another participant or Group and may include
a comment. Failure has no target or comment. Both go into the player's wallet.

## Cooldowns

Resolving a mission frees its slot but starts that slot's cooldown. The delay
uses the player's count of **all prior resolutions**, not just that slot:

```text
minutes = min(5 * 2^priorResolutionCount, 360)
sequence = 5, 10, 20, 40, 80, 160, 320, 360, 360, ...
```

Increment the resolution count once, whether success or failure. The future
server sets the slot deadline using its own clock and rejects early refill.
Clamp the exponent before calculation to avoid overflow at large counts.
An untouched initial slot is immediately eligible.

## Targets

You cannot successfully target yourself or repeat an individual until you have
successfully targeted every other current participant in that cycle. New
arrivals are added to that current eligibility set. Once all have been targeted,
the next individual success starts a new cycle. Group is always available and
does not advance or reset individual cycles.

Use player IDs, not display names, for rule enforcement. There is no leave/kick
roster change to account for initially.

## Shared views and secrets

- Score is successful mission count; no points for failures.
- Leaderboard uses random game-local aliases, distinct from roster/chat
  nicknames. It is pseudonymous display, not guaranteed unidentifiability.
- Member-only chat shows user messages and system success/failure messages.
  A result message reveals the resolved mission, not anybody's open missions.
- There is no private-message feature or public game feed.
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
