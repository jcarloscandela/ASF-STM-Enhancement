# Tasks

## 1. Harness spike and seam inventory

- [x] 1.1 Spike happy-dom vs jsdom against canned Steam DOM (badge page, trade page with rgInventory/rgContexts) and record the choice, verified by a spike note naming the winner and any emulation gaps.
- [x] 1.2 Install the chosen DOM harness as a devDependency and verify `pnpm install --frozen-lockfile` plus the full gate still pass with zero production imports of the harness.
- [x] 1.3 Map every nested function in `src/ASF-STM.ts` to pure / harness-testable / thin-shell and verify the map covers all ~60 functions with no behavior change (read-only inventory).

## 2. Pure-extraction slices (one per slice: extract, golden-test, rewire, gate green)

- [x] 2.1 Extract the gamecards-page parser (`parseGamecardsDocument` with quantities, titles, icons, unmatched detection) into `src/lib/` and verify golden tests replay pre-extraction outputs plus `pnpm typecheck && pnpm lint && pnpm test` pass.
- [x] 2.2 Extract the shared flat-badge predicate and unify the own-scan (:848) and bot-scan (:1156) filters on it, verified by fixture tests for flat/unflat/even/uneven shapes and a green gate.
- [x] 2.3 Extract the bot-badge builder (title/suffix hash mapping, skip-badge path) and verify golden tests cover exact, suffix, and unmatched-card cases with a green gate.
- [x] 2.4 Extract match-row view-data builders (filter widget state, `tradeParams.filter` updates, row/match template inputs) and verify golden tests replay row HTML with a green gate.
- [x] 2.5 Extract the trade-page offer planner (filter→Cards→selection order, tradable skip, abort conditions) building on the existing handoff helpers, verified by extended fixture tests and a green gate.

## 3. Harness suites and closeout

- [x] 3.1 Add harness suites for scan progress/filter DOM and `addCards`/`checkContexts` selection against canned inventories (no network, faked XHR seams), verified by passing suites plus a coverage report showing the orchestration layer covered.
- [x] 3.2 Update `AGENTS.md` and `README.md` for the harness rules and the new module map, bump the patch version, and verify `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm build` are all clean with the version in the bundle banner.
