# Project instructions

## Read first

- [Architecture](docs/architecture.md) defines the implemented/deferred boundary.
- [Game rules](docs/game-rules.md) are canonical. Update them with every mechanics change.
- [Database documentation](docs/database.md) defines SQL constraints, transaction
  obligations, data lifetimes, authorization, and validation limits.
- [Wireframes](docs/wireframes/README.md) define screen layout and navigation.
  Edit `tools/wireframes.mjs` and run `node tools\wireframes.mjs`; never hand-edit
  the generated SVGs.
- This branch has no app/API runtime. Do not invent startup commands or silently
  restore the old web/login model.

## Target implementation conventions

- Expo/React Native and Node.js with TypeScript; MySQL 8.4 LTS/InnoDB.
- Use functional React components, PascalCase component names, camelCase
  functions, explicit public types and interfaces for object shapes. Avoid `any`.
- Prefer the simplest existing helper/pattern. Keep state close to its owner;
  do not introduce global state or dependencies without a demonstrated need.
- Use native styles, centralized light/dark theme tokens, accessible controls,
  and an Expo-compatible Material Symbols implementation when UI is introduced.
  Do not carry over DOM/CSS/browser-storage assumptions. No decorative emojis.
- Future API envelopes: `{ success: true, data }` or
  `{ success: false, message }`, with appropriate HTTP status codes.
  Validate inputs, expose loading/error states, and never silently swallow errors.
- Authorize using per-game/per-pack secrets, not nicknames, codes or record IDs.
  Never log/store raw bearer secrets server-side or commit credentials.
- Every game relationship and query must be game-scoped. Use transactions and
  database constraints for claims, resolution, retry safety and cleanup.
- Preserve intended privacy: no cross-game identity, public private-pack catalog,
  permanent server game history, or other players' secret assignment payloads.

## Repository work

- Make scoped changes; preserve unrelated work. Do not connect to unknown
  databases or change cloud resources.
- Keep schema, dictionary, Mermaid and SVG consistent. Use the
  [database-change workflow](.github/skills/database-change/SKILL.md).
- Run `node --test tools\foundation.test.mjs`. Static checks do not establish
  MySQL compatibility or API correctness; state unexecuted tests explicitly.
- Use small numbered migrations; do not edit an already deployed migration.
  The initial migration in this foundation has not been deployed.
