# Proposal

## Why

The `present but not tradable right now` abort recurred after the 1.0.12 pool-shape fix, now on `252010-Geist` in both bulk and per-badge flows with a fresh scan. The debug record proves a different mechanism: the offer requests Geist **twice** (`send:[345,345]`) while the live pool holds **one** tradable copy (`poolCopies:1, flags:[1], holds:[null]`). The first occurrence consumes the only copy; the second shortfalls — but the detail reports pool-level facts, mislabeling per-occurrence exhaustion as a held card and sending the user to check trade holds for a card that is fully tradable.

## What Changes

- Distinguish copy-exhaustion from trade-held shortfalls: a requested occurrence that finds no remaining copy because earlier occurrences of the same offer already consumed every tradable copy SHALL report a dedicated `exhausted` reason (never `unselectable`), with occurrence-aware detail (requested occurrence index, tradable pool copies, copies already allocated by this offer).
- Make the visible dialog name the count mismatch (requested N, M tradable in pool, K already allocated to this offer) with rescan guidance that fits the cause, instead of the generic held-card wording.
- Investigate the scan-vs-live divergence behind the double request (scan promised 2 offerable, live pool holds 1 total): scan counting keys, trade-inventory pagination/completeness at offer time, and real inventory change between scan and offer. Fix the confirmed cause; if scan counting itself is wrong, extend this change with a second delta rather than silently absorbing it.
- Preserve all existing guarantees: shortfall only when an occurrence truly cannot be filled, zero net moves on any abort, retry still skips consumed ids.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `trade-offer-handoff`: shortfall classification gains copy-exhaustion as a first-class reason with occurrence-aware diagnostics and dialog wording; offer-time pool completeness is gated before planning.

## Impact

- Affected code: `src/lib/offer-writer.ts` (`planOfferSelection` shortfall reasons/detail, `formatShortfallMessage`, `retryUnselectableCopies` interplay), `src/ASF-STM.ts` (`addCards` pool-completeness gate); possibly `src/lib/tradable.ts` + `src/lib/matcher-core.ts` if the divergence investigation confirms a counting or double-promise defect (second delta in that case).
- Tests: `test/offer-harness.test.ts` (twice-requested + single-copy fixtures under SORT/RANDOM), `test/offer-writer.test.ts` (exhausted-reason unit tests, occurrence-aware detail, dialog wording).
- No settings, persistence, or URL-param changes; `absent` and `unselectable` behavior for genuinely missing/held cards is unchanged.
