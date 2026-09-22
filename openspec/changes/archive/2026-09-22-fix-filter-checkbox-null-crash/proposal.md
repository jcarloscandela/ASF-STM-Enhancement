# Proposal

## Why

Since commit `1f546ef` ("Improvements"), every scan that finds a match for a game not already present in the filter widget crashes with `TypeError: Cannot read properties of null (reading 'parentElement')` inside `addMatchRow` — thrown right when a partner's badge check finishes (`compareCards` → `addMatchRow`). The throw aborts before the continuation callback runs, so the scan chain also stalls after the first matched bot. The root cause is a single inverted boolean: the call site passes `checkBox === null` into `planFilterUpdate(checkboxExists, ...)`, whose contract is the opposite (`addedToFilter` is decided on `!checkboxExists`), sending the "checkbox exists" branch down a path where `checkBox` is null.

## What Changes

- Correct the `planFilterUpdate` call-site wiring in `addMatchRow` so a missing filter checkbox adds the filter entry and an existing checkbox only updates visibility and its match count — never re-adds it.
- Restore the intended row-visibility behavior for existing checkboxes (unchecked → row hidden; checked → row shown), which the same inversion also broke: an existing checkbox was re-treated as new, duplicating both the DOM checkbox and the persisted `tradeParams.filter` entry instead of honoring the checked state.
- Guarantee the post-match continuation runs: rendering a match row must complete without throwing, so `compareCards` always invokes its callback and the partner scan chain keeps advancing.
- Extend unit coverage to the call-site decision itself (missing vs. existing vs. unchecked checkbox), not only the pure helper, so this wiring cannot regress silently again.

## Capabilities

### New Capabilities

- `match-row`: Rendering a bot's match row after badge comparison — filter-widget reconciliation (add once, count matches, honor checked state, no duplicate DOM ids or persisted filter entries), row visibility derived from the checkbox state, and non-throwing completion that advances the scan chain.

### Modified Capabilities

<!-- None: existing requirements (trade matching, trade-offer handoff, scan lifecycle) are unaffected at the spec level; this is a defect in behavior no current spec covers. -->

## Impact

- `src/ASF-STM.ts` — `addMatchRow` filter-widget block (the `planFilterUpdate` call site) and, defensively, its label/count update path.
- `src/lib/match-row.ts` — `planFilterUpdate` contract stays as-is; tests gain call-site-level coverage.
- `test/match-row.test.ts` — new regression tests for the inversion (happy-dom only if DOM-level coverage is added).
- Runtime behavior: scans with matches render rows and continue to the next partner instead of throwing; `tradeParams.filter` (localStorage `TempAsfStm.ASF.STM.Params`) no longer accumulates duplicate appids, which also keeps the `match=all` handoff (`trade-offer-handoff`) resolving a clean filter.
- No API, dependency, or build changes; version bump per repo MUST rule.
