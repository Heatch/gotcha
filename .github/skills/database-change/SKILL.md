---
name: database-change
description: 'Use when changing Gotcha MySQL tables, migrations, seed SQL, database constraints, or the database ER diagram. Keep SQL, lifecycle contracts, Mermaid and SVG aligned and distinguish static checks from MySQL execution.'
---

# Database changes

1. Read [database documentation](../../../docs/database.md) and
   [game rules](../../../docs/game-rules.md). Confirm whether a behavior change
   affects game secrecy, per-game isolation, private pack ownership or expiry.
2. Update the initial migration only while undeployed; otherwise add the next
   numbered migration. Preserve MySQL 8.4/InnoDB compatibility, composite
   game-scoped foreign keys and explicit cleanup order.
3. Update the dictionary/transaction contracts and validation cases. Separate
   database-enforced invariants from future service obligations.
4. Update [Mermaid source](../../../docs/database.mmd) and regenerate the SVG
   using the command in the database documentation; inspect readability.
5. Run `node --test tools\foundation.test.mjs`. These structural checks are not
   a SQL engine and cannot prove concurrency or authorization behavior.
6. Execute SQL only against an explicitly approved disposable MySQL target.
   Never install/provision/connect to a database implicitly. Report runtime
   coverage and remaining unexecuted checks honestly.
