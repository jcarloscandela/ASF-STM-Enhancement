# Design

## Context

`GetOwnCards()` in `src/ASF-STM.ts` declares `let aborted = false` after the Phase-1 early return that calls `finish()`, while `finish()` reads `aborted`. Function declarations hoist, so on the zero-pending fast path `finish()` executes while `aborted` is still in its temporal dead zone → `ReferenceError`. See proposal.md Why. Other `Violation` / `chrome-extension` log lines are unrelated noise (Steam Prototype.js policy, SIH extension).

## Goals / Non-Goals

**Goals:**
- Eliminate the TDZ crash on the zero-pending path with a minimal, review-safe edit.

**Non-Goals:**
- No change to fetch pacing, retry, circuit-breaker, or matching behavior; no new dependencies.

## Decisions

- **Move `let aborted = false` (and co-located scan state) above Phase 1 derivation / early return** over alternatives (var hoisting, default param, guard with `typeof aborted`). Rationale: smallest diff, preserves `let` semantics and existing abort wiring in `fetchNext`/`onerror`; alternatives add lint risk or obscure control flow.
- **Regression test at fixture level** (zero-pending path completes without throw) over browser/manual verification. Rationale: repo tests are vitest with plain fixtures, no browser/network.

## Risks / Trade-offs

- [Risk] Bundled output line numbers shift → Mitigation: none needed; stack-trace line refs are informational.
- [Risk] Minimal scope misses similar TDZ patterns elsewhere → Mitigation: tasks include a grep for same-function use-before-let in scan flow.

## Migration Plan

Ship with normal userscript rebuild; no data migration, no rollback beyond version revert.
