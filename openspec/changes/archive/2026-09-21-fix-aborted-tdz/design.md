# Design

## Context

`GetOwnCards` (`src/ASF-STM.ts:615`) has two phases: Phase 1 derives every badge whose card list is already known (bundled dataset or browser cache); when nothing remains (`pending.length === 0`, line 642) it calls `finish()` and returns. Phase 2 declares the serial-fetch state — `let pendingIndex = 0; let aborted = false;` (lines 648–649) — *after* that early call. `finish` (line 820) reads `aborted` in its guard, and because `finish` is a hoisted function declaration closing over the `let`, the early call hits the temporal dead zone and throws `ReferenceError: Cannot access 'aborted' before initialization`. TypeScript and oxlint both accept this (it is valid scoping), so only a runtime or static-order guard catches it. The defect predates the current release but only triggers now that bundled coverage makes the empty-pending path common. See proposal.md — Why.

`GetOwnCards` is DOM- and network-entangled (reads `myBadges`, `XMLHttpRequest`, progress radials), so it cannot be unit-tested directly under the repo's no-browser vitest rule.

## Goals / Non-Goals

**Goals:**

- Empty-pending scans reach `finish()` without throwing, with `aborted` observably `false`.
- A regression guard that fails on the current code and passes after the fix, runnable via `pnpm test`.
- Zero change to the serial-fetch abort semantics.

**Non-Goals:**

- No refactor of `GetOwnCards` into testable units (out of proportion for a two-line ordering fix; the guard is static, not behavioral).
- No new runtime dependency or spec change (`skip_specs: true`).

## Decisions

### D1: Hoist both `let` declarations above Phase 1, keep `finish` unchanged

Move `let pendingIndex = 0; let aborted = false;` to the top of `GetOwnCards`, before the Phase 1 loop. The early `finish()` then reads initialized state (`false`), and Phase 2 continues to use the same bindings.

*Alternatives considered:*
- Remove the `if (aborted)` guard from `finish` — rejected: it weakens the abort path for the serial-fetch phase, which relies on `finish` being a no-op after abort.
- Initialize `aborted` at module scope — rejected: it would leak abort state across scan runs; the per-invocation `let` is the correct lifetime.
- Convert to `var` — rejected: hides the ordering problem instead of fixing it and violates the codebase's `let`/`const` discipline.

### D2: Static regression guard, not a behavioral test

Because `GetOwnCards` cannot run under vitest (DOM/XHR/globals), the guard is a test that reads `src/ASF-STM.ts` source and asserts the declaration order invariant: the `let aborted` (and `let pendingIndex`) initializations appear textually before the `if (pending.length === 0)` early-`finish()` call inside `GetOwnCards`. It fails on the current source and passes after D1.

*Alternatives considered:*
- Extracting the pending-split logic into a pure function in `src/lib/` for behavioral testing — cleaner long-term, but expands a crash fix into a refactor with matcher-core-adjacent surface; recorded as follow-up, not this change.
- Manual-only verification in Tampermonkey — necessary as end-to-end confirmation (empty-cache scan with full coverage completes), but not a substitute for an automated guard.

## Risks / Trade-offs

- [Source-text test is brittle to formatting/refactor] → Mitigation: match on the minimal stable tokens (`let aborted`, `pending.length === 0`, `finish()`) scoped to the `GetOwnCards` body, not exact lines; any future extraction of the function will break the test loudly, which is the desired signal to revisit it.
- [Same TDZ pattern may exist elsewhere] → Mitigation: implementation includes a quick audit of sibling scan functions (`fetchInventory`/`GetCards` paths) for guards read before their `let` initialization; fix only if the same crash is reachable, otherwise note and stop.

## Migration Plan

1. Reorder the two declarations, add the guard test, bump `package.json` patch version.
2. Gate: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`; confirm the built bundle's `GetOwnCards` has the initialization before the early `finish()` call.
3. Ship as a patch release; rollback = revert (previous bundle behavior returns, crash included).
