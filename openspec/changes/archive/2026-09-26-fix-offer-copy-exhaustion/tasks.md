# Tasks

## 1. Reproduce exhaustion misdiagnosis

- [x] 1.1 Add failing Geist-shaped fixtures (requested twice, pool holds one tradable copy) under SORT and RANDOM in `test/offer-harness.test.ts` and verify the second occurrence currently misreports `unselectable` with pool-level detail via `pnpm test`.
- [x] 1.2 Add a scan-vs-live divergence fixture matrix: classid-shared descriptions with mixed verdicts through `buildInventoryCardCounts`, and a matcher pass asserting one card is never promised twice beyond its offerable surplus, and verify which suspect reproduces the double request via `pnpm test`.

## 2. First-class exhaustion

- [x] 2.1 Record `exhausted` (with occurrence index, tradable pool-copy count, and already-allocated count) when an occurrence finds no remaining copy only because earlier occurrences consumed them, keeping pool-level facts on the record, and verify the 1.1 fixtures now report `exhausted` via `pnpm test`.
- [x] 2.2 Render the exhausted wording in `formatShortfallMessage` (requested N, M tradable in pool, K already allocated, rescan guidance) while `absent`/`unselectable` wording stays unchanged, and verify with dialog-content tests via `pnpm test`.
- [x] 2.3 Fix the confirmed divergence cause from 1.2 (counting key, matcher double-promise, or real-change handling; add a second delta spec if scan counting or matcher rules change) and verify the Geist-shaped end-to-end fixture aborts loudly with the exhausted wording and zero moves via `pnpm test`.

## 3. Pool completeness gate

- [x] 3.1 Identify an observable fully-loaded signal for both trade inventories (or a bounded wait plus partial-inventory warning when none exists) and gate `addCards` planning on it, and verify with readiness-harness tests via `pnpm test`.

## 4. Regression and release gates

- [x] 4.1 Run the full verification suite (`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`) and verify all gates pass with no `dist/` commit.
- [x] 4.2 Run `openspec validate fix-offer-copy-exhaustion --strict` and verify the change validates with all required artifacts present.
