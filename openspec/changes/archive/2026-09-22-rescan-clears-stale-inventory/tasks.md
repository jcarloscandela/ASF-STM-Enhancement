# Tasks

## 1. Stop invalidates the bot cache

- [x] 1.1 Clear the in-memory `bots` and remove the persisted BotCache key via `removeKey` in `stopButtonEvent` (`src/ASF-STM.ts`), reusing the existing `bots === null` refetch path on next scan, verified by a unit/harness test asserting both cache layers are empty after Stop.
- [x] 1.2 Verify the post-Stop rescan issues a fresh bot-listing fetch even within the 5-minute freshness window, and that settings, blacklist, badge-card metadata, and Params survive Stop, verified by fixture tests for each surviving key.

## 2. Verification and release chores

- [x] 2.1 Run the full suite (`pnpm test`) with no regressions and confirm the scan→Stop→rescan flow refetches bots in a DOM-level test if the existing harness permits, otherwise via the cache-state assertions from 1.1–1.2.
- [x] 2.2 Bump `package.json` patch version, sync version refs in `AGENTS.md`/`README.md`, and verify `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` all pass.
