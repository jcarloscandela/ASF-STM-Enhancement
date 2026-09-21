# Tasks

## 1. Audit old-vs-new trade path

- [x] 1.1 Diff match-row URL builders (partner/token/source/match=all vs match=appid) old-vs-new and record divergences, verified by a written diff note in the change.
- [x] 1.2 Diff params persistence (storeMatches/SaveParams/LoadParams shape: matches keys, filter, cardNames ordering/encoding) and verify round-trip with a vitest fixture.
- [x] 1.3 Diff trade-page parsing (source gate, getUrlVars, partner-key resolution, filter→Cards construction, balance/empty gates) and the checkContexts/selection loop, verified by mapping each suspect to a spec scenario.

## 2. Fix handoff and selection

- [x] 2.1 Fix partner-key + cardNames + filter resolution so match=all and match=appid both build non-empty balanced Cards, verified by handoff fixture tests (bot + friend URL forms).
- [x] 2.2 Fix offer-page item selection (tradable-only, both sides filled; missing-item abort preserved), verified by selection-logic tests and manual tradeoffer check.
- [x] 2.3 Ensure every failure path shows the alert dialog with the storage-key hint and debug log, verified by triggering each abort (bad partner, bad match, empty Cards, unbalanced sides).

## 3. Verify release

- [x] 3.1 Run pnpm typecheck, lint, test, and build successfully, verified by clean command output.
- [ ] 3.2 Manual end-to-end: scan → "Offer a trade for all" fills all trades and per-badge button fills that badge, verified on a live Steam tradeoffer URL; bump package.json patch version per repo versioning rule.
