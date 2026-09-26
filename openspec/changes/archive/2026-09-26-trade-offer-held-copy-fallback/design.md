# Design

## Context

`planOfferSelection` (`src/lib/offer-writer.ts`) pre-filters pool copies by the metadata verdict and `addCards` (`src/ASF-STM.ts`) aborts before moving anything when a shortfall exists. The metadata verdict was proven consistent with scan time, yet `unselectable` aborts persist — so the pool metadata itself diverges from what Steam will accept. See proposal.md for motivation; specs define the retry and diagnostics contract.

## Goals / Non-Goals

**Goals:**
- Treat the live trade as ground truth for copies metadata rejects, without weakening the loud empty-offer abort for copies Steam truly rejects.
- Capture per-copy diagnostic facts on every future occurrence.

**Non-Goals:**
- Changing matcher sizing, set-progress ownership semantics, or the metadata verdict itself.
- Auto-rescanning or rebuilding match data from the offer page.

## Decisions

- **Two-phase fill in `addCards`: metadata plan first, live retry second.** Phase 1 runs the existing planner unchanged (fast path, fully fixture-tested). Phase 2 runs only for `unselectable` occurrences: for each, attempt each present copy via `MoveItemToTrade` in pool order and confirm by slot count; keep the first copy that sticks, skip ones Steam ignores. Alternative (retry inside the pure planner) rejected: acceptance is a DOM side effect and cannot be fixture-tested in the pure module.
- **Retry is additive-only and verified per copy.** Each attempt checks the slot count before and after; a copy that adds nothing is left out and the next is tried. If none sticks, the original shortfall stands and zero net moves remain — the empty-offer guarantee is preserved. Alternative (move-all-then-rollback) rejected: rollback of a partially accepted trade is unreliable.
- **Diagnostics ride the existing shortfall record.** Extend `UnsuppliedCard` with an optional detail payload (copy count, flag values seen, parsed hold dates, scan-time tradable count passed in from persisted match context); `formatShortfallMessage` output stays unchanged while `debugPrint` logs the full record. Alternative (dialog shows everything) rejected: dialog must stay scannable.
- **Version staleness needs no code change.** `@version ${VERSION}` in `rolldown.config.ts` already injects `package.json`; the fix is verifying `dist/` carries 1.0.10 and publishing the release per the existing `userscript-release` flow.

## Risks / Trade-offs

- [Risk] Attempting held copies could briefly flash items into slots → Mitigation: attempts are per-copy with immediate slot-count verification; failures leave no item behind, and the final slot-parity check still gates sending.
- [Risk] Live retry masks a real hold that expires later → Mitigation: only copies Steam accepts are kept; anything rejected still aborts loudly with diagnostics.
- [Risk] Pool item shape on the offer page lacks fields the diagnostics want → Mitigation: record what exists, mark the rest unknown; fail-open behavior unchanged.
