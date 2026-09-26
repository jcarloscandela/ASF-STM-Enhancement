# Proposal

## Why

Scans correctly count temporally-held copies as owned-but-untradable, yet the trade-offer handoff still aborts with `present but not tradable right now` even when the matched card has a tradable copy (e.g. owned 3 with 2 blocked). Users get an empty offer instead of a valid 1:1 swap.

## What Changes

- Align the offer-page tradability verdict with the scan-time verdict (flag + `Tradable After` hold), so a copy counted as tradable at scan time is also selectable at offer time.
- Make the offer selection explicitly prefer currently-tradable copies when multiple copies of the same card exist, and only report `unselectable` when no tradable copy remains.
- When a shortfall still occurs, keep the loud empty-offer abort but make the dialog actionable (which card, how many tradable copies the scan saw vs the offer page saw, rescan guidance).
- Add fixture coverage for mixed held/tradable copies of the same card on both sides.

## Capabilities

### New Capabilities

- None (behavior fix within existing capabilities).

### Modified Capabilities

- `trade-offer-handoff`: offer selection must pick a currently-tradable copy when one exists; shortfall diagnosis must distinguish scan-vs-offer tradability drift.
- `tradable-card-filter`: scan-time and offer-time tradability verdicts must agree on flag + time-gated holds.

## Impact

- `src/lib/offer-writer.ts` (selection preference + shortfall detail), `src/lib/tradable.ts` (shared verdict for offer-page items), `src/ASF-STM.ts` thin wiring for dialog data.
- Tests: `test/offer-harness.test.ts`, `test/tradable.test.ts` fixture additions.
- No API, storage-schema, or metadata changes expected.
