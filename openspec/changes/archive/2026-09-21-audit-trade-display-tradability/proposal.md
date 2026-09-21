# Proposal

## Why

A user walked through two concrete 5-card trade scenarios involving temporarily trade-held copies and asked for an audit of the trade-display/matching process: held-but-owned cards must never be requested, and offers must never exceed currently tradable copies. The specs and fixture tests already describe both scenarios, so this change systematically verifies the implementation against them and closes any gaps the audit finds.

## What Changes

- Audit `computeMatches` (`src/lib/matcher-core.ts`) and the tradable-count plumbing (`src/ASF-STM.ts` card fill, `src/lib/tradable.ts`) against the two reported scenarios:
  - Scenario 1: A×5 tradable, D×1 held, B/C/E×0 vs bot holding 2 of each → expect exactly A→B, A→C, A→E, never requesting D.
  - Scenario 2: A×5 with 4 held (1 tradable), D×1 held, B/C/E×0 vs the same bot → expect exactly one swap (A→B, C, or E).
- Probe adjacent edges the scenarios imply: fair (non-ANY) bot mode, multi-iteration tradable accounting (sends decrement, receives increment), badge-eligibility filtering with zero tradable copies, and match-row display counts.
- Add missing fixture tests and spec scenarios for any gap found; fix the implementation if the audit finds a behavior bug (bug fixes recorded in the delta specs).
- No behavior change is expected: if the audit confirms the implementation, the change lands as verification (tests + scenarios) only.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `matcher-core`: tighten the tradable-count requirement with audit scenarios (fair-bot variant, multi-iteration accounting) if gaps are found; correct it if the audit finds a bug.
- `trade-matching`: same, at scanner level (eligibility, match-row display, offer-time selection) if gaps are found; correct it if the audit finds a bug.

## Impact

- Code under audit (read-only unless a bug is found): `src/lib/matcher-core.ts`, `src/lib/tradable.ts`, tradable-count wiring in `src/ASF-STM.ts`.
- Likely additions: `test/matcher-core.test.ts` fixtures, delta specs for `matcher-core` / `trade-matching`.
- No API, dependency, or distribution changes.
