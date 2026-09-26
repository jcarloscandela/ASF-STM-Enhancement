# Design

## Context

See proposal.md (Why): a valid 1-for-1 swap aborts with `present but not tradable right now` despite one tradable copy existing. Current state: `planOfferSelection` in `src/lib/offer-writer.ts` filters the live pool via `isTradeOfferItemTradable` before SORT/RANDOM ordering, and `addCards` in `src/ASF-STM.ts` builds pools from `Object.values(live.rgInventory)` then runs `retryUnselectableCopies` as ground truth. Existing specs (`trade-offer-handoff`, `trade-matching`, `tradable-card-filter`) already require tradable-only selection and verdict parity, and harness tests cover the 3-copy repro only when the tradable copy has the highest id. The failure therefore lies in a gap between the specified behavior and the live pool shape or verdict application, not in missing scan-time counting.

## Goals / Non-Goals

**Goals:**
- Guarantee the reported repro (2 held + 1 tradable) always fills from the tradable copy under SORT and RANDOM, regardless of id order.
- Establish verdict parity between scan-time counting (`isCurrentlyTradableDescription`) and offer-time filtering on the real `rgInventory` item shape.
- Keep the loud-abort contract: shortfall only when zero tradable copies exist, zero net moves on any abort.

**Non-Goals:**
- No change to scan-time counting, badge eligibility, matcher fairness, or persisted Params shape.
- No change to dialog wording or storage keys; diagnostics reuse the existing shortfall record.
- No auto-rescan or hold-expiry waiting; the offer still aborts when nothing is tradable right now.

## Decisions

- **Decision: Filter-then-order, proven by position-variant tests.** Filter the pool to tradable copies first, then apply SORT (highest tradable id) or RANDOM (index among tradable only). Alternative (order-then-skip) was rejected because ordering over a mixed pool lets a held copy win the pick when verdict parsing diverges. New tests pin the tradable copy at lowest, middle, and highest id positions for both orderings.
- **Decision: Treat the live `rgInventory` shape as suspect and verify it first.** The planner casts `rgInventory` values to `OfferPoolItem`; if real items nest `tradable`, `descriptions`, or `market_hash_name` differently (or omit hold text that the scan-time `descriptions`/`owner_descriptions` carry), the verdict silently passes held copies or fails tradable ones. Investigation compares a captured live item against `SteamInventoryDescription` before changing verdict code. Alternative (assume shape is correct and only tweak ordering) was rejected because it would not explain a shortfall when a tradable copy is present.
- **Decision: Keep the metadata plan authoritative and the live retry a net-zero safety net.** The retry stays restricted to `unselectable` shortfalls, skips ids already consumed, and removes all trial moves unless every occurrence resolves. Alternative (retry every request, or keep partial trial moves) was rejected because it risks leaving a held copy in the trade or a partial offer.
- **Decision: Single-capability delta (`trade-offer-handoff`).** The scan-time specs already state the correct counting and parity rules; only the offer-selection contract needs tightening. Alternative (also modifying `trade-matching`/`tradable-card-filter`) was rejected to avoid duplicating unchanged requirements.

## Risks / Trade-offs

- [Risk] Real `rgInventory` hold text uses a date format `getTradableAfterTime` cannot parse → held copies pass the verdict and win SORT by id. → Mitigation: extend parser/formats only after reproducing with the captured live item; unparseable still fails open to the flag, so flag-only held copies remain safe.
- [Risk] Real `rgInventory` items lack `market_hash_name` on the top level (name lives on a nested description) → tradable copy looks absent. → Mitigation: normalize the pool construction in `addCards` to resolve the name the same way the scan does, covered by a pool-shape test.
- [Risk] Fixing the pick changes which copy id fills the offer (lowest-id tradable instead of highest-id held). → Mitigation: accepted; any tradable copy is a correct fill and existing SORT/RANDOM tests pin tradable-only ordering.
- [Risk] Over-broadening the retry masks stale scan data (offer succeeds with a copy the scan counted as held). → Mitigation: retry still records resolved vs pending and the debug log keeps per-copy diagnostics; scan counting is untouched.

## Migration Plan

No migration. Userscript behavior change only; no settings, cache, or stored-data format changes. Rollback is the previous bundle.

## Open Questions

None. The live pool-shape check is investigative work inside the implementation tasks, not a spec or approach changer: either outcome (shape fix vs verdict/order fix) satisfies the same tightened requirement.
