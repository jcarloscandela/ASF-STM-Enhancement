# Design

## Context

`planOfferSelection` in `src/lib/offer-writer.ts` already skips items failing `isTradeOfferItemTradable`, but the reported failure (`yours: 72850-Troll, present but not tradable right now` despite 1 tradable of 3 owned) shows the offer-page pool verdict disagrees with the scan-time count. Scan counting keys tradability per `classid` description; the offer pool carries per-item `rgInventory` entries whose shape (missing `tradable` flag vs `descriptions` hold lines) may diverge. See proposal.md for motivation; specs define the agreed verdict.

## Goals / Non-Goals

**Goals:**
- Single shared verdict for scan and offer paths, with explicit preference for tradable copies at selection time.
- Shortfall path stays loud and empty (no partial moves) with actionable rescan guidance.

**Non-Goals:**
- Changing match sizing (`offerable = max(min(tradable, owned - target), 0)`) or set-progress ownership semantics.
- Retrying/rebalancing to a different card when the requested name has no tradable copy.

## Decisions

- **Reuse `isCurrentlyTradableDescription` for offer items; harden `isTradeOfferItemTradable` null-handling.** `isTradeOfferItemTradable(null)` currently returns `true` (fail-open); keep fail-open only for genuinely missing metadata, but treat a present pool item with an explicit negative flag or future hold as unselectable. Alternative (separate offer-only parser) rejected: it caused this drift.
- **Filter-then-consume per name, unchanged order semantics.** Build `tmpCards` from tradable copies only, SORT descending by id / RANDOM by injected index, splice on consume. Alternative (sort tradable-first then pick) rejected: it would silently mix held copies into `cardTypes` and break the 1:1 type check.
- **Diagnose drift in the dialog data, not just the name.** Pass scan-time tradable counts alongside `shortfalls` so the dialog can state `scan saw N tradable / offer page saw M`. Alternative (log-only) rejected: user only sees the dialog.

## Risks / Trade-offs

- [Risk] Offer-page `rgInventory` items omit hold text that the inventory API includes → verdict still disagrees → Mitigation: fixture-test both shapes; if hold text is absent, fall back to the flag verdict and surface the drift counts in the dialog.
- [Risk] Clock skew on `Tradable After` parsing → Mitigation: reuse existing `getTradableAfterTime`/`hasFutureTradeHold` with injectable `now` (already pure/testable).
