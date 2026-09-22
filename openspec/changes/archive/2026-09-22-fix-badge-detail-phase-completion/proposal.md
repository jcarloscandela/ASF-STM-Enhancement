# Proposal

## Why

Every scan whose badge-detail phase has at least one pending fetch crashes at the end of the phase: `fetchNext` reads `pending[pendingIndex]` with no bounds guard, so after the last entry is processed the next scheduled call finds `undefined` and throws `TypeError: Cannot read properties of undefined (reading 'appId')`. The serial phase has no completion handoff at all — `finish()` is reachable only from the zero-pending fast path (and git history shows no bounds guard ever existed) — so instead of proceeding to filtering/sorting and bot matching, the scan dies with an uncaught exception. Additionally, any interruption mid-phase (this crash, a reload, a tab restore) discards all in-memory scan state: while each learned game's badge details already persist per-game in the browser badge-card cache, the queue position, derived badge state, and inventory counts do not, so the next scan restarts every earlier phase from scratch.

## What Changes

- **Completion guard in the serial detail loop:** when the pending index reaches the end of the list, the phase transitions through the same `finish()` path as the zero-pending fast path — no out-of-range read, no extra badge-detail request, no exception — and the scan continues to filtering/sorting and downstream matching exactly once.
- **Exact phase progress:** the badges progress radial advances only when a pending entry is actually completed (retries and the final handoff no longer inflate or overshoot it), reads exactly `N / N` when the phase ends, and resets to zero at the start of each scan (`GetOwnCards` runs from both scan flows, so `currentStep` must reset per run; today only `steps` is set).
- **Temporary scan-resume state:** the badge-detail phase persists its in-flight state — derived badge state, the pending queue with its position, and the inventory counts pending fills still need — to per-tab `sessionStorage` as it advances. The next scan started in the same tab with the same scan plan resumes that phase from the versioned record instead of re-running the inventory/eligibility phases or re-fetching completed entries. The record is cleared on phase completion, scan finish, and user stop; a plan/version mismatch, corrupt record, or unavailable storage degrades silently to a fresh scan. Learned per-game details remain in the existing localStorage badge-card cache — the resume record complements it with queue-level continuity rather than duplicating it.
- **Idempotent badge-detail application:** filling a badge's slots from a detail response rebuilds that badge's slot list instead of appending, so an entry interrupted mid-fill (or re-applied on resume) can never produce duplicated cards.
- **Regression coverage:** pure fixture tests for the resume record over a fake `StorageLike` (round-trip, version/plan validation, corrupt-data and quota safety, clearing), plus the existing source-contract precedent extended to the guard, progress placement, reset, and resume wiring, so any of it regressing fails the suite.
- The console noise in the report that is not ours (Prototype.js permissions-policy violation, Angular `ERR_FILE_NOT_FOUND` from a browser extension) is out of scope; only the userscript TypeError and scan continuity are addressed.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `scan-lifecycle`: two added requirements — (1) serial badge-detail path completion: no read past the pending list, exactly-once handoff to matching equivalent to the fast path, exact per-scan progress, no handoff from an aborted phase; (2) interrupted-phase resume from temporary per-tab storage with plan/version validation, silent fresh-scan fallback, and guaranteed record removal on completion/stop. The capability's Purpose (worded for the fast path only) is widened in the main spec to cover both completion paths and resume.

## Impact

- Code: `src/ASF-STM.ts` — `GetOwnCards` (guard + handoff, progress placement/reset, resume record writes/clears, resume hook after plan resolution, idempotent `fillCards`); new pure module `src/lib/scan-resume.ts`; one new key in `STORAGE_KEYS` (`src/lib/storage.ts`) bound to `sessionStorage` at the call site.
- Tests: new `test/scan-resume.test.ts` (fixture tests with a fake `StorageLike`); `test/scan-lifecycle.test.ts` gains source-contract cases alongside the two existing ones.
- Behavior visible in the UI: scans with fetched badge details reach matching instead of throwing; the badges radial fills exactly to completion per scan; a scan interrupted during the badge-detail phase resumes where it left off on the next Scan click in that tab.
- Storage: adds one new `sessionStorage` key; no existing storage keys, request formats, settings semantics, or dependencies change. Retry/abort semantics remain owned by `scan-resilience`. Patch version bump per repo MUST rule; AGENTS/README updated for the new lib module and storage key (docs-sync rule).
