# Tasks

## 1. Dataset bundling and card derivation

- [x] 1.1 Commit the normalized dataset schema (`data/card_counts.json`: appId -> `{size, name?, cards?[]}`) with a loader in `src/lib/tradable.ts` (or `src/lib/dataset.ts`) that normalizes today's counts-only export into it; verify with `test/tradable.test.ts` fixtures (counts-only array, rich object, invalid entries ignored) and `pnpm test`
- [x] 1.2 Inline the dataset at build time via the rolldown template-text mechanism (no runtime fetch for bundled data); verify `pnpm build` emits `ASF-STM.user.js` containing the dataset and no `{{PLACEHOLDER}}` tokens
- [x] 1.3 Add covered-game derivation: for a candidate game with a bundled/cached card list, build card slots from the list (hash, zero-count slots included) combined with the inventory counting pass (owned/tradable per hash); verify with `test/tradable.test.ts` fixtures (zero-owned slots present, owned counts from inventory, nothing-to-match filter) and `pnpm test`

## 2. Serial detail stage and browser cache

- [x] 2.1 Remove the parallel crawl machinery from `GetOwnCards` (worker pool, cursor, settle counting) and restore the serial, web-limiter-paced one-at-a-time detail fetch for games without a known card list; keep per-badge retry within the global error budget, invalid-badge filtering, and the populated tail; verify with `pnpm typecheck` and a grep confirming no concurrency constants/worker remnants remain
- [x] 2.2 Wire the resolution chain in `getBadgesInventory`: bundled dataset -> browser cache -> remote badges database (lazy, once per run, sizes+titles cached) -> serial detail fetch (learned lists written to the cache); verify with `pnpm typecheck` and cache round-trip fixtures in `test/tradable.test.ts`
- [x] 2.3 Add the versioned localStorage key (`TempAsfStm.ASF.STM.BadgeCards.v1`) via the existing storage lib (readJson/writeJson with corrupt-cache fallback); verify with `test/tradable.test.ts` cache fixtures (round-trip, corrupt ignored) and `pnpm test`
- [x] 2.4 Pin Steam text fetches to `l=english` (`ajaxgetbadgeinfo`, partner badge pages) and switch partner card mapping to title-based matching (exact first, then suffix; unmatchable card skips the badge with a debug note); verify with `pnpm typecheck` and fixture-based mapping tests
- [x] 2.5 Verify scan flow end-to-end on fixtures: bundled/learned games derive locally with zero badge-detail requests, unknown games fetch serially and land in the cache; verify with `pnpm test`

## 3. Gates, docs, and release

- [x] 3.1 Run the full gate set (`pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm build`); verify `dist/ASF-STM.user.js` builds with the dataset inlined, no unreplaced placeholders and no `// DEBUG` markers
- [x] 3.2 Update `README.md` and `AGENTS.md`: dataset schema, the steam-cards-bot regeneration workflow, the browser card cache, and the serial-only badge-detail rule; verify no stale parallel-crawl references remain
- [x] 3.3 Bump the package version in `package.json` (patch minimum) per the versioning rule
