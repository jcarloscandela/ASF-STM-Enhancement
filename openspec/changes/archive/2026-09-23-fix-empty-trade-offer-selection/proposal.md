# Proposal

## Why

Users opening a scan-generated trade-offer URL sometimes see a failure dialog with an empty offer: neither their cards nor the partner's cards are selected. The current abort leaves the offer empty by design (no partial moves), but the visible error does not say which stage failed (handoff resolution vs live-inventory selection) nor which cards/keys were involved, so the user cannot tell whether to rescan, wait out a trade hold, or report a bug.

## What Changes

- Diagnose the reported empty-selection failure: enumerate every code path that can leave both sides empty (`missing url parameter` / `invalid url parameter`, `no matches with this partner`, `Different items amount`, `nothing to add, exiting`, live-inventory `Cards missing` shortfall, slot-count mismatch, non-1:1 type veto) and record which one the reporter hit.
- Harden the trade-offer handoff so an empty offer always carries an actionable cause:
  - Name the failed stage (handoff-data vs live-inventory), the resolved partner-key candidates tried, the appid filter resolved, per-appid match presence, skipped card-id count, and `Cards[2]` counts.
  - Keep the atomicity guarantee (zero moves on any failure) and make the empty state explicit in the dialog ("no items were added") instead of an apparently hung page.
- Separate dialog attribution: handoff-data violations keep naming `TempAsfStm.ASF.STM.Params` (`matches`/`filter`/`cardNames`); live-inventory shortfalls name per-card side + absent-vs-unselectable reason and never blame the Params key.
- Add fixture coverage for each empty-selection path so regressions fail loudly in `pnpm test` instead of in a live trade window.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `trade-offer-handoff`: empty-offer failures must report stage-specific diagnostics (partner keys tried, filter, per-appid presence, skipped ids, Cards counts, per-card shortfalls) and preserve the zero-moves atomicity with an explicit empty-offer message.

## Impact

- Affects `src/lib/matcher-core.ts` (handoff resolvers `resolveTradeFilter` / `resolvePartnerMatches` / `resolveTradeCards`), `src/lib/offer-writer.ts` (shortfall planning/reporting), and the trade-page wiring in `src/ASF-STM.ts` (`addCards`, `checkContexts`, handoff `try/catch` dialogs).
- No scan/matching behavior change; no new runtime dependencies; pure-lib changes stay fixture-testable under vitest with no browser/network.
