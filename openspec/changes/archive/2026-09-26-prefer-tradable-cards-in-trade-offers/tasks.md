# Tasks

## 1. Reproduce and fixture

- [x] 1.1 Add failing fixtures: 3-copy same-hash pool (2 held via flag / future `Tradable After`, 1 tradable) for SORT and RANDOM in `test/offer-harness.test.ts`, plus offer-shaped vs scan-shaped description parity cases in `test/tradable.test.ts`, and verify they fail before the fix (`pnpm test`).
- [x] 1.2 Confirm scan-vs-offer verdict drift on the `72850-Troll` shape (which field differs) and record the finding in the task/plan notes.

## 2. Fix selection and verdict

- [x] 2.1 Harden `isTradeOfferItemTradable` in `src/lib/tradable.ts` to share `isCurrentlyTradableDescription` for present items (flag + hold), keeping fail-open only for null/undefined, and verify `test/tradable.test.ts` passes.
- [x] 2.2 Ensure `planOfferSelection` in `src/lib/offer-writer.ts` builds candidate pools from tradable copies only, consumes one per requested occurrence in order, and emits `unselectable` vs `absent` shortfalls correctly; verify `test/offer-harness.test.ts` passes.
- [x] 2.3 Enrich the shortfall dialog data path (scan-time vs offer-time tradable counts) with thin `src/ASF-STM.ts` wiring only, and verify the dialog names the card, side, reason, and rescan guidance.

## 3. Verify

- [x] 3.1 Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` and verify all pass.
- [x] 3.2 Bump `package.json` patch version per repo versioning rule and update `AGENTS.md`/`README.md` only if behavior docs drift.

## Notes

- 1.2 finding: no verdict drift exists in code — `isTradeOfferItemTradable` already delegates to `isCurrentlyTradableDescription` (flag + future `Tradable After` hold), locked by the new parity test. The reported `72850-Troll` failure means zero copies were currently tradable at offer time (holds acquired or inventory changed between scan and offer); the loud empty-offer abort naming the card with `present but not tradable right now` + `then rescan` guidance is the correct behavior for that state.
- 2.1/2.2: implementation already satisfied the specs; new regression fixtures (mixed flag-held + hold-text + tradable copies, SORT and RANDOM) pass against the existing code, so no `src/` change was needed.
- 2.3: `formatShortfallMessage` already names side, card, absent-vs-unselectable reason, and rescan guidance; existing harness tests assert this. No `src/ASF-STM.ts` wiring change needed.
- 3.2: bumped to 1.0.10. No `AGENTS.md`/`README.md` change: externally observable behavior is unchanged (regression lock-in only).
