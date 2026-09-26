# Design

## Context

See proposal.md (Why): per the user's debug record, `send:[345,345]` requests Geist twice while the live pool holds one tradable copy (`poolCopies:1, flags:[1], holds:[null]`). Current state (`src/lib/offer-writer.ts` `planOfferSelection`): occurrences consume tradable copies in request order, and an occurrence finding an empty `tmpCards` entry records `unselectable` with pool-level detail (`present.length`, all flags/holds). The second Geist occurrence therefore misreports exhaustion as a held card. The matcher (`src/lib/matcher-core.ts` `computeMatches`) decrements both `count` and `tradableRemaining` per send and requires `tradableRemaining > 0`, so a single pass cannot double-promise one copy — the double request implies scan-time counts promised ≥2 offerable while live shows 1 total. Scan counting (`src/lib/tradable.ts` `buildInventoryCardCounts`) keys descriptions by `classid` alone; the offer page (`src/ASF-STM.ts` `checkContexts`) plans once both inventories merely exist and report `cLoadsInFlight === 0`.

## Goals / Non-Goals

**Goals:**
- Make exhaustion first-class: `exhausted` reason, occurrence-aware detail, and a dialog that names the count mismatch (requested N, M tradable in pool, K allocated).
- Determine why scan promised 2 offerable while live holds 1 (counting-key collapse vs paginated/incomplete trade inventory vs real inventory change) and fix the confirmed cause.
- Gate planning on fully loaded live inventories so partial pools cannot manufacture exhaustion shortfalls.

**Non-Goals:**
- No change to `absent`/`unselectable` semantics for genuinely missing/held cards, to the retry's net-zero contract, or to matcher fairness and set-target rules.
- No auto-rescan, no hold-expiry waiting, no new persisted data.

## Decisions

- **Decision: New `exhausted` reason instead of reusing `unselectable`.** The occurrence knows whether tradable copies ever existed (`tmpCards` emptiness) versus whether any remain (allocation count). Reusing `unselectable` preserves the exact misdiagnosis being fixed; a distinct reason lets the dialog, the retry skip logic, and future analytics treat "already used up" differently from "held". Alternative (keep one reason, enrich detail only) rejected — the visible dialog renders per-reason wording and the user already proved the current wording misleads.
- **Decision: Occurrence-aware detail alongside (not instead of) pool facts.** The shortfall keeps `poolCopies`/`flagValues`/`holdDates` and adds occurrence index, tradable-pool count, and allocated-by-offer count. Alternative (replace detail) rejected — pool facts remain the evidence for genuine held-vs-absent disputes.
- **Decision: Investigate divergence with a fixture matrix before fixing counting.** Three suspects need one discriminating test each: (a) classid-keyed counting collapse — two descriptions sharing a classid with mixed verdicts must count per (classid, instanceid); (b) paginated trade inventory — planning must observe fully loaded pools; (c) real inventory change — out of scope to prevent, but the dialog must say so. Alternative (assume pagination and gate only) rejected — if counting is wrong the matcher keeps over-promising and the gate fixes nothing.
- **Decision: Single-capability delta (`trade-offer-handoff`).** Matcher and counting requirements only change if the matrix convicts them; the proposal records that fork explicitly so a second delta is added then, not presumed now.

## Risks / Trade-offs

- [Risk] Trade-inventory "fully loaded" has no clean signal beyond `cLoadsInFlight`/inventory existence → gate may wait forever or change nothing. → Mitigation: the investigation task must identify an observable completeness signal first; if none exists, the gate becomes a bounded wait plus an explicit partial-inventory warning instead of a silent plan.
- [Risk] New reason string breaks log scrapers/tests matching on `unselectable`. → Mitigation: existing tests pinning `unselectable` for fully-held pools stay green; only the consumed-exhaustion path changes reason, covered by new tests.
- [Risk] Fixing the dialog wording without fixing the double request leaves users blocked with a clearer error only. → Mitigation: tasks order the divergence fix before dialog polish, and acceptance requires the Geist-shaped fixture (request 2, pool 1) to abort loudly with the exhausted wording AND the matcher/counting fix to stop the over-promise at its confirmed source.

## Migration Plan

No migration. Userscript behavior change only; no settings, cache, or stored-data changes. Rollback is the previous bundle.

## Open Questions

None. The divergence cause is investigative work inside the implementation tasks with a pre-committed fork (second delta if counting/matcher is convicted).
