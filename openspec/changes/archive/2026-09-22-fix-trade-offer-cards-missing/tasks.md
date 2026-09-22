# Tasks

## 1. Planner shortfall records

- [x] 1.1 Extend `OfferSelectionPlan` in `src/lib/offer-writer.ts` with per-occurrence shortfall records (side, name, absent vs. unselectable) populated wherever `failLater` is set, verified by new `test/offer-writer.test.ts` fixtures covering absent-name, fully-held-name, and duplicate-name pools.
- [x] 1.2 Run the existing offer suites (`pnpm test test/offer-writer.test.ts test/offer-harness.test.ts`) and verify no regressions in the success-path plan shape.

## 2. All-or-nothing moves and distinct dialogs

- [x] 2.1 Reorder `addCards` in `src/ASF-STM.ts` to move items only when the plan has no shortfalls, leaving the offer empty on failure, verified by an `offer-harness` fixture asserting zero `MoveItemToTrade` calls when a requested card is unsupplied.
- [x] 2.2 Split the failure dialogs so live-inventory shortfalls name each unsupplied card with its reason (capped list plus full debug log) while handoff-data failures keep the Params-key text, verified by harness tests asserting dialog content for each failure class.

## 3. Verification and release chores

- [x] 3.1 Reproduce the reported 6-vs-6 case as a fixture (balanced `Cards[2]`, user pool missing 2 tradable copies) and verify the flow aborts with the named-cards dialog and an empty offer instead of 4-vs-6 plus "Cards missing".
- [x] 3.2 Bump `package.json` patch version, sync version refs in `AGENTS.md`/`README.md` if changed, and verify `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` all pass.
