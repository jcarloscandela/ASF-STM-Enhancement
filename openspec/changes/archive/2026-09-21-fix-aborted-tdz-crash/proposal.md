# Proposal

## Why

Scanning a badge page where every badge resolves from bundled/card-cache data (zero pending badge-detail fetches) crashes with `ReferenceError: Cannot access 'aborted' before initialization` at `finish()` called from `GetOwnCards()`. The scan never completes for fully-covered users.

## What Changes

- Declare the `aborted` scan-cancellation flag before Phase 1 derivation and the early `finish()` return in `GetOwnCards()`, eliminating the temporal-dead-zone (TDZ) access.
- Add regression coverage: unit/fixture test exercising the zero-pending path (all badges resolved locally → `finish` runs without throwing).
- Bump patch version per repo versioning rule.

## Capabilities

### New Capabilities

- `scan-lifecycle`: zero-pending badge scan completes via the local-data fast path without badge-detail requests and without throwing.

### Modified Capabilities

None — existing scan-resilience/trade-matching requirements unchanged; this is a bug fix restoring intended behavior.

## Impact

- Affected code: `src/ASF-STM.ts` `GetOwnCards()` (~lines 620-654, 825-828); `test/` regression test.
- No API, dependency, or UX changes; only the crash path is fixed.
