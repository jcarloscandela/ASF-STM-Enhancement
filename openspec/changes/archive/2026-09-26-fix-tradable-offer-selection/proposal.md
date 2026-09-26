# Proposal

## Why

Trade-offer creation fails with `present but not tradable right now` even when the user owns a currently-tradable copy of the requested card (reported: 3× Card A with 2 temporally blocked, 1 tradable). The offer planner reports a shortfall instead of selecting the tradable copy, or selects a held copy and Steam rejects it, so a valid 1-for-1 swap (A → B/D) never fills.

## What Changes

- Harden live offer-time selection so a requested card with at least one currently-tradable pool copy always fills from a tradable copy and never reports a shortfall for that occurrence.
- Guarantee held copies (trade-state negative or future `Tradable After`) are never moved into the trade when a tradable copy of the same name exists, under both SORT and RANDOM orderings.
- Align the offer-time tradability verdict with the scan-time verdict (same flag + hold-date rules, same fail-open behavior) and keep the ground-truth live retry as a safety net, never as a path that introduces a held copy.
- Preserve existing loud-abort behavior: shortfall only when zero tradable copies remain; failed offers move zero items and name side/card/reason.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `trade-offer-handoff`: tighten offer-selection to guarantee tradable-copy preference, verdict parity with scan time, and shortfall-only-when-truly-unselectable behavior.

## Impact

- Affected code: `src/lib/offer-writer.ts` (`planOfferSelection`, `retryUnselectableCopies`), `src/lib/tradable.ts` (shared verdict), `src/ASF-STM.ts` (`addCards` pool construction and retry wiring).
- Tests: `test/offer-writer.test.ts`, `test/offer-harness.test.ts` (mixed held/tradable repro with tradable copy at every id position and both orderings).
- No API, settings, or persistence changes; no behavior change for fully-held or absent cards (still loud abort with zero moves).
