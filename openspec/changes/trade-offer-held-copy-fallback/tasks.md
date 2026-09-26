# Tasks

## 1. Diagnostics

- [x] 1.1 Extend `UnsuppliedCard` in `src/lib/offer-writer.ts` with an optional detail payload (pool copy count, `tradable` flag values seen, parsed hold dates) and populate it in `planOfferSelection` for `unselectable` shortfalls; verify new unit coverage in `test/offer-harness.test.ts` passes.
- [x] 1.2 Pass the scan-time tradable count for each shortfallen card into the detail payload (thin `src/ASF-STM.ts` wiring from persisted match context) and log the full record via `debugPrint`; verify the dialog text from `formatShortfallMessage` is unchanged.

## 2. Live retry fallback

- [x] 2.1 Add the phase-2 retry in `addCards` (`src/ASF-STM.ts` only): for each `unselectable` occurrence, attempt each present pool copy via `MoveItemToTrade` with per-copy slot-count verification, keeping the first copy that sticks; verify with a DOM-harness test mirroring the existing `test/offer-harness.test.ts` style.
- [x] 2.2 Preserve the abort guarantees: when no present copy sticks, the original shortfall stands with zero net moves and the slot-parity check still gates sending; verify the fully-held fixture still aborts loudly with an empty offer.

## 3. Version staleness and release

- [ ] 3.1 Run `pnpm build` and verify `dist/ASF-STM.user.js` carries `@version 1.0.11` (mechanism already injects `package.json`; this is confirmation, not a code change).
- [ ] 3.2 Publish the GitHub release for 1.0.11 with the distributable attached per the existing `userscript-release` flow, and verify Tampermonkey offers the update from the release asset URL.

## 4. Verify

- [ ] 4.1 Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` and verify all pass.
- [ ] 4.2 Bump `package.json` patch version per repo versioning rule (only if `src/`, `scripts/`, or `test/` changed) and update `AGENTS.md`/`README.md` only if behavior docs drift.
