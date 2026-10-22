# Trust, safety and privacy

What the app needs so that players are protected and the app passes store
review: moderation, terms, the privacy policy, data retention and age rating.
Choices: [D12](decisions.md#d12-moderation), [D13](decisions.md#d13-minimum-age).
This is a plan, not legal advice; have the terms and privacy policy reviewed
before launch.

## Store requirements

Gotcha has user-generated content: chat, nicknames, custom missions and pack
titles. Both stores require, for such apps:

| Requirement | Apple (Guideline 1.2) | Google Play (UGC policy) | Gotcha plan |
| --- | --- | --- | --- |
| Terms users accept, with zero tolerance for objectionable content | Yes | Yes | [First-launch terms](#terms-of-use) |
| Filter objectionable content | Yes | Yes | [Word filter](#word-filter) |
| Report offensive content | Yes | Yes | [Report](#report) |
| Block abusive users | Yes | Yes (recommended) | [Block](#block) |
| Act on reports (Apple: within 24 hours) | Yes | Yes | [Review process](#review-process) |
| Published contact information | Yes | Yes | Support email in Rules and store listing |
| Privacy policy | Yes | Yes | [Privacy policy](#privacy-policy) |

Both also ask for privacy disclosures (App Store privacy labels, Google Play
data safety form) and an age rating questionnaire.

## Report

Available from: a long-press on a chat message, a player in the lobby roster,
and a mission in the offer or resolve screen (for custom packs).

- Reasons: harassment, hate, sexual content, dangerous mission, spam, other;
  optional details up to 500 characters.
- The server stores a **copy** of the reported content, because the game and
  its messages are purged 7 days after it ends. Reports are kept 90 days, then
  deleted.
- The reporter gets a confirmation and can also block the player.
- New reports notify reviewers through the support inbox or
  `REPORT_ALERT_WEBHOOK` ([operations](operations.md#configuration)).

## Block

Device-only, for one game, because there is no cross-game identity. A blocked
player's chat messages are hidden behind "Message from a blocked player" (tap
to show). Result posts still count, since they come from the server. Blocking
does not tell the other player. The host can go further and remove them.

## Host removes a player

Proposed rule change (not yet in the [game rules](game-rules.md)):

- The host can remove any other player, in the lobby or during play, with
  confirmation.
- The removed membership is marked removed; their secret stops working
  (`403 PLAYER_REMOVED`) and the nickname stays reserved. Without accounts the
  same person could join again under a new nickname (if late joining is on);
  the host can remove them again or turn late joining off.
- Their open missions return to the pool (pending [open question 6](decisions.md#open-questions)).
  Their completed results and score stay in history but they leave the
  leaderboard and target lists.
- A "Host removed a player" settings-style post appears in chat, without
  a reason.

## Word filter

- Server-side, shared by all write routes, with a maintained word list
  (English first) plus normalization for spacing and look-alike characters.
- Nicknames, pack titles, descriptions and custom missions: rejected with
  `422 CONTENT_REJECTED`, and the form shows which field.
- Chat: the matching words are masked, not rejected, so conversation keeps
  flowing.
- Built-in packs are reviewed by people before release and must suit 13+.
  Some missions in the illustrative seed involve physical tasks; review them
  ([database.md](database.md)).

## Review process

- One named reviewer (to be decided, [open question 3](decisions.md#open-questions))
  checks reports daily, within 24 hours.
- Actions: none; delete a pack from the catalog; or, for an active game, end
  it. Because there are no accounts, a ban is limited to that game.
- A small admin script (not a public endpoint) lists open reports and applies
  actions; it runs with production credentials from an operator's machine.

## Terms of use

Shown on first launch (`/welcome`, see [mobile app](mobile-app.md#routes)):
confirm 13 or older and accept the terms and privacy policy. Key points:

- No objectionable or harassing content; the host and reviewers may remove
  content and players.
- Missions are dares between consenting friends: never do anything unsafe,
  illegal or unwanted by others. The honour system applies.
- Games and chat are temporary; nothing is kept on the server after a game
  expires except saved packs and reports.

The terms and policy are hosted web pages linked from the app, the store
listing and `/v1/meta`.

## Privacy policy

### Data inventory

| Data | Where | Kept for | Linked to a person? |
| --- | --- | --- | --- |
| Nickname, alias, chat, comments, results | Server | Until the game is purged (7 days after it ends, or 30 days inactive) | No account; a nickname may identify someone to their friends |
| Custom pack content | Server | Draft: with the game. Saved pack: until its owner deletes it | No |
| Membership and pack secrets | Device; server keeps only hashes | Device: until removed. Server: with the game or pack | No |
| Push token | Server, per membership | Until the game is purged or the token is cleared | Device identifier, not linked across games |
| Reports (copy of content) | Server | 90 days | No |
| IP address | Server logs and rate-limit counters | 14 days | Possibly |
| Crash reports (if accepted) | Sentry | 30 days | No; no game content or secrets |
| Game history, downloaded chat | Device only | Until the player deletes it | Stays on the phone |

No advertising, no tracking across apps, no analytics IDs, no selling of data.

### Store disclosures (expected)

- **Apple privacy labels:** User Content (other user content) and Identifiers
  (device ID, for push), used for app functionality, not linked to identity,
  not used for tracking. Diagnostics if crash reporting is on.
- **Google data safety:** messages and other user-generated content and device
  IDs collected, encrypted in transit, not shared, deletable by the user (game
  data deletes itself; saved packs by their owner).

### Deletion

- Game data deletes itself on the schedule above; no request is needed.
- Saved packs: deleted by their owner in My packs. Without the secret (lost
  phone) the support email can delete a pack by ID and title.
- Device data: "Remove from this device" per game, or uninstall the app.
- Google Play's account-deletion requirement does not apply because there are
  no accounts; the data safety form says so.

## Age rating

Minimum age 13 in the terms. Expected questionnaire results: unrestricted chat
between users and user-generated content, mild crude humour possible in
custom missions, no violence, gambling or purchases. Expected ratings: Apple
12+ and Google Play Teen; IARC decides the final ratings.
