# Design

## Context

See proposal.md Why. The handoff has two resolution stages: `resolveTradeCards` maps persisted matches to market-hash names (`Cards[2]`, balance-checked in `src/ASF-STM.ts:2186`), then `planOfferSelection` (`src/lib/offer-writer.ts:53`) matches each name against the live inventory pools, skipping untradable copies (`isTradeOfferItemTradable`) and flagging `failLater` for names with no selectable copy. `addCards` currently applies the partial moves first and only then fails on the slot-count check (`src/ASF-STM.ts:2044-2061`), which is why the user saw 4-vs-6 plus a Params-blaming dialog.

## Goals / Non-Goals

**Goals:**

- Zero partial offers: all-or-nothing item moves.
- Per-card failure attribution (side, name, absent vs. unselectable).
- Keep the success path behavior identical.

**Non-Goals:**

- Changing match computation, scan, or the Params storage schema.
- Retrying, waiting for, or re-scanning inventory when cards are missing.
- Altering Steam's own trade-hold or tradability rules.

## Decisions

- **Check-then-act in `addCards`: evaluate the plan before moving any item** (alternative: unwind partial moves after failure). Rationale: `MoveItemToTrade` has no clean undo and the plan already carries `failLater`; gating moves on a clean plan is a smaller, safer change.
- **Extend `OfferSelectionPlan` with per-name shortfall records** (alternative: recompute missing names in the host wiring). Rationale: the planner already knows, per name, whether copies were absent or skipped-as-untradable; returning that avoids duplicating pool-matching logic in `src/ASF-STM.ts`.
- **Two distinct dialogs**: handoff-data failures keep the Params-key text; live-inventory shortfalls get new text naming the cards and their reasons (alternative: one combined message). Rationale: the reported bug is precisely the misattribution; separate texts make the distinction observable and testable.
- **Reason classification reuses `isTradeOfferItemTradable` outcomes**: absent (no pool item with that `market_hash_name`) vs. present-but-unselectable (matched items all failed the tradability predicate). No new tradability rules.

## Risks / Trade-offs

- [Steam inventory loads lazily; a slow load could look like "absent"] → Mitigation: planning still runs only after `checkContexts` confirms both inventories loaded (`assessTradeReadiness` == 2); no behavior change there.
- [Dialog text length with many missing cards] → Mitigation: cap listed names with a "+N more" tail; full list goes to the debug log.
- [Duplicate card names across badges] → Mitigation: shortfall records are per requested occurrence, consistent with the planner's per-occurrence consumption.

## Migration Plan

Pure userscript change: implement, cover with `offer-writer`/`offer-harness` fixtures (partial pool, fully-held pool, partner-side shortfall), bump patch version per repo MUST rule. Rollback: previous release asset; no storage or spec-schema migration involved.
