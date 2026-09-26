# Tasks

## 1. Diagnostics

- [x] 1.1 Extend `UnsuppliedCard` in `src/lib/offer-writer.ts` with an optional detail payload (pool copy count, `tradable` flag values seen, parsed hold dates) and populate it in `planOfferSelection` for `unselectable` shortfalls; verify new unit coverage in `test/offer-harness.test.ts` passes.
- [x] 1.2 Pass the scan-time tradable count for each shortfallen card into the detail payload (thin `src/ASF-STM.ts` wiring from persisted match context) and log the full record via `debugPrint`; verify the dialog text from `formatShortfallMessage` is unchanged.

## 2. Live retry fallback

- [x] 2.1 Add the phase-2 retry in `addCards` (`src/ASF-STM.ts` only): for each `unselectable` occurrence, attempt each present pool copy via `MoveItemToTrade` with per-copy slot-count verification, keeping the first copy that sticks; verify with a DOM-harness test mirroring the existing `test/offer-harness.test.ts` style.
- [x] 2.2 Preserve the abort guarantees: when no present copy sticks, the original shortfall stands with zero net moves and the slot-parity check still gates sending; verify the fully-held fixture still aborts loudly with an empty offer.

## 3. Version staleness and release

- [x] 3.1 Run `pnpm build` and verify `dist/ASF-STM.user.js` carries `@version 1.0.11` (mechanism already injects `package.json`; this is confirmation, not a code change).
- [x] 3.2 Publish the GitHub release for 1.0.11 with the distributable attached per the existing `userscript-release` flow, and verify Tampermonkey offers the update from the release asset URL.

## 4. Verify

- [x] 4.1 Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` and verify all pass.
- [x] 4.2 Bump `package.json` patch version per repo versioning rule (only if `src/`, `scripts/`, or `test/` changed) and update `AGENTS.md`/`README.md` only if behavior docs drift.

## Notes

- 1.2 limitation: the offer page's persisted params (`matches`/`filter`/`cardNames`, verified in `SaveParams`) carry no per-card scan-time tradable counts, and persisting them would be a storage-schema change (out of scope). `detail.scanTradable` therefore stays unset on the offer page; the existing `debugPrint("unsupplied cards: ...")` line now logs the full detail (pool copies, flag values, hold dates) automatically, and `formatShortfallMessage` output is byte-identical (asserted in tests).
- 2.1 deviation from design: the retry core lives in `src/lib/offer-writer.ts` as `retryUnselectableCopies` with injected `moveItem`/`slotCount` deps (same testability pattern as `assessTradeReadiness`); `addCards` holds only the thin wiring. Covered by 3 new `test/offer-harness.test.ts` cases (accepts-after-held, accepts-nothing, skips-consumed + absent passthrough).
- Retry runs only when `RemoveItemFromTrade` exists on the page (needed to restore zero net moves on partial success); otherwise behavior is exactly as before.
- 3.x/4.2 ordering: bumped to 1.0.11 first (repo MUST rule: `src/`+`test/` changed), so 3.1/3.2 targeted 1.0.11 instead of the planned 1.0.10.
- 3.2 root cause of the user's stale 1.0.9: CI only creates releases as **drafts** — published 1.0.11 via `gh release edit --draft=false` with `ASF-STM.user.js` attached. Older drafts (1.0.3–1.0.10) left untouched. Tampermonkey update itself is user-side (reinstall/update from the release asset URL).
- 4.2 docs: updated stale `1.0.9` version strings in `AGENTS.md`/`README.md` to `1.0.11` and noted drafts must be published for managers to update.
