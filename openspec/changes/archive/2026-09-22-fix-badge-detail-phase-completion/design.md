# Design

## Context

See proposal.md for motivation. Current state of `GetOwnCards` (src/ASF-STM.ts):

- Phase 1 (lines ~612-641) splits badges into locally-derived vs `pending`; `progressRadials.badges.steps = pending.length`, and zero pending calls `finish()` directly.
- Phase 2's `fetchNext` (line 682) checks `aborted`, `stop`, and the circuit-breaker gate, then calls `updateProgress("badges")` and reads `const entry = pending[pendingIndex]!` (line 701) — **no bounds check**. Success/invalid-drop paths do `pendingIndex++` and `setTimeout(fetchNext, weblimiter)`; retry paths re-enter without incrementing.
- **There is no completion transition**: `finish()` is called only at line 639 (fast path); `git log -S` shows no bounds guard ever existed. After the last entry, the scheduled call reads `pending[length]` → `undefined` → `entry.appId` throws — the reported stack (`at Proxy.fetchNext …:67021:92`, entered via the timer machinery) matches this call exactly.
- Progress: `updateProgress("badges")` runs once at `fetchNext` top — it counts *calls*, so retries inflate it and the crashing (N+1)-th call would overshoot; `progressRadials.badges.currentStep` is never reset (only `steps` is set at line 637), while `GetOwnCards` is invoked from both scan flows (lines 1140 and 1387), so a second scan in one session starts from a stale step count.
- **Persistence landscape:** `src/lib/storage.ts` provides the generic JSON primitive (`StorageLike`, `readJson`/`writeJson`/`removeKey`) with centrally declared `STORAGE_KEYS`; tests already fake `StorageLike` in memory. The badge-card cache (localStorage, `TempAsfStm.ASF.STM.BadgeCards`) already persists each learned game's detail result — so per-game *results* survive; queue position, derived `myBadges`, and `inventoryCardCounts` do not. The scan plans resolve via `resolveScanPlan` at the scan entry points (lines ~1121, ~1533), before any inventory work — the natural resume decision point.
- The existing `test/scan-lifecycle.test.ts` establishes the source-contract coverage precedent: `GetOwnCards` lives in the userscript closure (unimportable), so lifecycle contracts are asserted against the source text.

## Goals / Non-Goals

**Goals:**
- One bounds guard that turns end-of-list into the same `finish()` handoff the fast path uses.
- Badge-phase progress that advances only on real completion, ends exactly at its total, and resets per scan.
- A versioned, plan-tied resume record in per-tab `sessionStorage` that lets the next same-plan scan continue the badge-detail phase instead of restarting, with silent fresh-scan fallback in every failure mode.
- Fills that are idempotent, so resume/retry can never duplicate a badge's cards.
- Source-contract tests for the wiring and pure fixture tests for the resume record.

**Non-Goals:**
- Resume for phases *before* the badge-detail phase (inventory paging, badges-database eligibility): those re-run on resume by design — the record captures their outputs, not their in-progress state; a crash there falls back to a fresh scan (the per-game badge-card cache still preserves learned details).
- Resume *past* the badge-detail phase: the record is cleared at phase completion, so bot matching (`GetCards`) never resumes from it.
- Cross-session persistence (`localStorage`) or multi-day resume offers — `sessionStorage` only, per the "temporarily" requirement; stale inventory state from a previous day is deliberately impossible.
- A resume-confirmation prompt/UX — resume is automatic when the plan matches (same tab, same plan, minutes apart); alternative noted in D4.
- Retry policy, rate-limit, or abort semantics (`scan-resilience` owns classification, breaker, and retry delays; abort paths already set `aborted` and are unchanged).
- Extracting the fetch loop into `src/lib/*` — it stays host wiring per AGENTS.md; only its lifecycle contract is pinned textually, while the resume record itself is a pure module with fixture tests.
- Other progress radials (`bots`, `botBadges`, `scanPages`) and their reset behavior.
- The non-userscript console noise in the bug report (Prototype.js, extension errors).

## Decisions

**D1 — Guard at the top of `fetchNext`, before the gate and the pending read.** Insert, after the `aborted`/`stop` checks and before the circuit-breaker gate: if the pending index is at or past the end, call `finish()` and return. Rationale: a single choke point all entry paths (initial call, post-success schedule, post-retry schedule) pass through; placing it before the gate prevents a completed phase from being aborted by an open breaker; placing it before `updateProgress`/entry read makes both overshoot and the OOB read unreachable. Alternatives considered: bounds check at each of the two `pendingIndex++` sites — rejected, two sites to keep in sync and future paths can forget; conditionally scheduling `setTimeout` only when more entries remain — rejected, three scheduling sites with asymmetric initial call; wrapping the read in try/catch — rejected, masks the real control-flow gap (same reasoning as the filter-checkbox fix: spec requires non-throwing completion, not swallowed exceptions).

**D2 — Progress advances on completion, and resets per scan.** Move the `updateProgress("badges")` call from `fetchNext` top to immediately after each `pendingIndex++` (the two advance sites), and set `progressRadials.badges.currentStep = 0` next to the existing `progressRadials.badges.steps = pending.length` assignment. Result: retries and aborts don't move the radial, it reads exactly `N / N` at handoff, and every scan starts from zero. Cosmetic trade-off: the radial shows `0 / N` during the first fetch instead of `1 / N` (completed-count semantics). Alternatives considered: keep the top call and rely on the D1 guard alone — rejected, retries still inflate and the stale-`currentStep` multi-scan bug remains; clamp inside the shared `updateProgress` — rejected, it would silently alter every radial.

**D3 — Source-contract tests for the wiring in `test/scan-lifecycle.test.ts`.** Extend the existing file with assertions on the source text: bounds guard before the `pending[pendingIndex]` read with `finish()` in its branch; `updateProgress("badges")` only with index advancement; `badges.currentStep` reset alongside the `steps` assignment; the resume hook present before inventory work, record writes at phase start/advance, and record clears at `finish()`/`stopEventCleanup`. Rationale: same constraint and precedent as the existing tests (closure-untestable host wiring).

**D4 — Resume record as a pure module over `sessionStorage`.** New `src/lib/scan-resume.ts`: record type `{ version, planKey, myBadges, inventoryCardCounts, pendingAppIds, pendingIndex, badgesSteps }` plus `buildScanResumeRecord`, `readScanResume` (validates version, planKey, and field shapes — anything else returns `undefined`, never throws), `writeScanResume` (wraps the storage call so quota errors degrade silently), and `clearScanResume`. The key (`TempAsfStm.ASF.STM.ScanResume`) joins `STORAGE_KEYS`; the userscript passes `sessionStorage` as the `StorageLike`. `planKey` is the stable JSON of the resolved `ScanPlan`. Write cadence: phase start (once `pending` is built) and after each `pendingIndex++`; clear in `finish()` (phase/scan completion) and `stopEventCleanup` (user stop and every abort route) — a crash writes nothing further, leaving the record for resume. Resume hook: after plan resolution at the scan entry, `readScanResume` on a match restores `myBadges`, `inventoryCardCounts`, `pending` (rebuilt from `pendingAppIds` + restored badges), `pendingIndex`, steps, and `cardNames` (rebuilt from restored slots), then continues directly at Phase 2. Alternatives considered: `localStorage` — rejected, offers stale cross-day resumes and contradicts "temporarily"; a resume-confirmation prompt — rejected, no prompt infrastructure and plan-matched auto-resume is safe in-tab; storing only the queue position — rejected, earlier phases would still re-run, defeating "instead of restarting"; zod validation — rejected, no new dependencies rule; shape-checking matches the badge-card cache's corrupt-ignored discipline.

**D5 — Idempotent fill.** `fillCards` resets `badge.cards = []` before pushing slots. Covers a crash that landed between partial pushes and any re-application of the same response; `cardNames` is a set, so re-adding hashes is harmless. Alternative considered: clearing pending badges' cards only at resume — rejected, the invariant belongs at the fill itself so retries and resume both stay correct.

## Risks / Trade-offs

- [Textual tests are brittle to formatting/refactoring] → Mitigation: assert order/containment/count relationships, mirroring the existing tests that have survived refactors; `pnpm format` runs before them in the gate; the resume record itself is covered behaviorally, not textually.
- [`0 / N` first-paint instead of `1 / N`] → Intended semantic change (completed-count), pinned by the spec scenario; purely cosmetic.
- [Handoff runs `finish()` twice if a future path also calls it] → `finish()` gains exactly one new reachability point (the guard); source-contract test pins the structure.
- [sessionStorage quota exceeded on very large inventories] → `writeScanResume` catches storage errors; the spec's fresh-scan-degrades scenario pins the behavior.
- [Stale-but-valid record within a tab (inventory changed between crash and resume)] → Accepted: same tab + same plan + minutes apart; inventory truth is re-established on the next fresh scan; plan/version guards cover the common mismatch cases.
- [Restoring a wrong-shape record corrupts the scan] → `readScanResume` validates every field's shape before returning it; invalid → `undefined` → fresh scan (spec scenario).
- [Behavior change surprises users whose scans "worked" by crashing into the console] → The crash left the scan stalled before matching; the fix is the intended flow.

## Migration Plan

Patch release: bump `package.json`, rebuild `dist/ASF-STM.user.js`. Adds one `sessionStorage` key (new namespace, no existing keys touched); no settings, request-format, or localStorage changes. Users get the fix on the normal userscript update; rollback = previous release asset (a stale `sessionStorage` record from the new version is simply ignored by a rolled-back build that never reads the key).

## Open Questions

None — the defect mechanism is fixed by the stack trace and source walk; the resume scope, storage choice (per-tab `sessionStorage`), and automatic (non-prompted) resume were decided with the user before this revision.
