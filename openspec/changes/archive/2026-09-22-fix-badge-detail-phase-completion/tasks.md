# Tasks

## 1. Source-contract regression coverage (red)

- [x] 1.1 Add a source-contract test in `test/scan-lifecycle.test.ts` asserting, on `GetOwnCards`'s body, that a pending-index bounds guard (`pendingIndex >= pending.length`) exists before the `pending[pendingIndex]` read and that the guard's branch calls `finish()`; verify `pnpm test` fails because the current source has no guard
- [x] 1.2 Add source-contract tests asserting `updateProgress("badges")` never precedes the pending read (it must sit with the `pendingIndex++` advance sites, two occurrences) and that `progressRadials.badges.currentStep = 0` is reset alongside the `steps` assignment before any advancement; verify these also fail against the current source
- [x] 1.3 Run `pnpm test` and confirm exactly the new completion-contract cases are red (all other suites green) to establish the baseline before implementing

## 2. Completion guard, handoff, progress

- [x] 2.1 In `fetchNext` (src/ASF-STM.ts), insert the bounds guard after the `aborted`/`stop` checks and before the circuit-breaker gate: when the pending index is at or past the end, call `finish()` and return — no pending read, no `updateProgress`, no request; verify the 1.1 test passes and inspection confirms `finish()` now has exactly one Phase-2 reachability point
- [x] 2.2 Move `updateProgress("badges")` from the top of `fetchNext` to immediately after each of the two `pendingIndex++` advance sites, and add `progressRadials.badges.currentStep = 0` next to the existing `progressRadials.badges.steps = pending.length` assignment; verify the 1.2 tests pass

## 3. Scan resume state

- [x] 3.1 Write fixture tests first in `test/scan-resume.test.ts` (fake in-memory `StorageLike`) covering: record round-trip; version mismatch → `undefined`; planKey mismatch → `undefined`; corrupt/missing JSON → `undefined`; field-shape validation → `undefined`; a storage whose `setItem` throws → write degrades without throwing; clear removes the key; verify they fail because `src/lib/scan-resume.ts` does not exist yet
- [x] 3.2 Add `TempAsfStm.ASF.STM.ScanResume` to `STORAGE_KEYS` and implement `src/lib/scan-resume.ts` per design D4 (record type, `buildScanResumeRecord`, `readScanResume`, `writeScanResume`, `clearScanResume`); verify the 3.1 tests pass
- [x] 3.3 Make `fillCards` idempotent per design D5 (reset `badge.cards` before pushing slots); verify by re-reading `fillCards` that a second fill of the same badge cannot duplicate cards
- [x] 3.4 Wire the host side per design D4: write the record at phase start and after each `pendingIndex++`; clear it in `finish()` and in `stopEventCleanup`; add the resume hook after plan resolution that restores `myBadges`, `inventoryCardCounts`, `pending`/`pendingIndex`, steps, and `cardNames` and continues at Phase 2; verify with new source-contract tests in `test/scan-lifecycle.test.ts` (resume hook before inventory work, writes at phase start/advance, clears at `finish()`/`stopEventCleanup`) — verify these fail before the wiring and pass after
- [x] 3.5 Run `pnpm test` and verify the full suite passes: both new suites plus the two pre-existing scan-lifecycle tests and all untouched suites

## 4. Verification and housekeeping

- [x] 4.1 Run `pnpm typecheck`, `pnpm lint`, and `pnpm format:check` and verify all three pass
- [x] 4.2 Run `pnpm build` and verify `dist/ASF-STM.user.js` exists with no `{{PLACEHOLDER}}` tokens and no `// DEBUG` markers
- [x] 4.3 Bump the `package.json` version (patch: 1.0.2 → 1.0.3), sync the version references in `README.md` and `AGENTS.md`, add the new `scan-resume` lib module to AGENTS/README layout and feature wording where modules/keys are enumerated (docs-sync rule), and verify the built userscript header carries `@version 1.0.3`
- [x] 4.4 Run `openspec validate --change "fix-badge-detail-phase-completion" --strict` and verify it passes with both delta requirements resolving against the `scan-lifecycle` main spec
- [x] 4.5 Manually walk the paths by re-reading the touched code: zero pending unchanged (fast path), single/N pending hand off exactly once, retry re-fetches without advancing, abort paths never reach `finish()` or clear-and-resume incorrectly; resume restores state only on same plan+version, mismatch/corrupt/quota fall back to a fresh scan, and completion/stop leave no record behind
