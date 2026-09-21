# Design

## Context

See proposal.md Why. The audit target is `computeMatches` in `src/lib/matcher-core.ts`: need-checks read owned `count` (lines 99-100), give-checks additionally require `tradableRemaining > 0` (line 112) where `tradableRemaining = min(tradableCount ?? count, count)` (line 86); sends decrement both counters and receives increment both (lines 150-158). Tradable counts arrive via `tradableCount` set from the inventory pass (`src/ASF-STM.ts` card fill) or fall back to owned counts. Existing specs (`trade-matching`, `matcher-core`) and fixtures (`test/matcher-core.test.ts` held-card cases) already encode both user scenarios.

## Goals / Non-Goals

**Goals:**
- Execute the audit: replay both user scenarios plus fair-bot, multi-iteration accounting, eligibility, and display edges against the implementation, and land tests plus spec scenarios for the results.

**Non-Goals:**
- No matching-behavior change unless the audit proves a bug; no UI, distribution, or dependency changes.

## Decisions

- **Audit by executing fixtures, not by reading code alone** over a pure code review. Rationale: the fair-bot path (bot-side fairness rejects later swaps as received counts catch up) and the re-sort loop make hand-traced swap counts unreliable; only executed fixtures establish the true counts.
- **Assert invariants plus exact counts where execution confirms them** over exact counts everywhere. Rationale: ANY-mode counts (3 swaps / 1 swap) are already pinned by existing fixtures; fair-mode exact counts are left to the audit to pin, with never-request-held and capacity-cap invariants asserted regardless.
- **Fix-forward on bug, verify-only otherwise.** Rationale: the specs already describe the intended behavior, so a deviation is a bug in code, not a design question; the tasks require updating the deltas if execution contradicts them.

## Risks / Trade-offs

- [Risk] Audit-written scenario text misstates fair-mode exact counts → Mitigation: tasks execute fixtures before finalizing scenario text and correct the deltas on mismatch.
- [Risk] Received-card remainder increment (line 158) permits re-offering a just-received card, surprising the user → Mitigation: audit task explicitly traces whether a received card is re-offered in the user scenarios and records the verdict.

## Migration Plan

None: verification-only unless a bug is found, in which case the fix ships with the normal patch-bump and rebuild flow.
