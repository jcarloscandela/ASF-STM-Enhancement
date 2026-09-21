# Tasks

## 1. Diagnose the first-run failure

- [x] 1.1 Reproduce the first-run stall/failure path by tracing `prepareInventoryScan` → `fetchInventory` → `getBadgesInventory`/`getBadges` in `src/ASF-STM.js` and record the confirmed trigger(s) (unhandled rejection, radial-state leak, stale async overwrite, or bots-cache two-click flow), verified by a written repro note referencing the exact lines and console behavior.
- [x] 1.2 Confirm scan-mode matrix affected (inventory on/off × scan filters on/off) and verify the matrix is documented in the change notes before fixing.

## 2. Fix first-run scan reliability (tradable filter preserved)

- [x] 2.1 Guard `prepareInventoryScan` with a monotonic run token plus `stop` checks so stale inventory/badge-DB completions are discarded, verified by code review showing every async continuation checks the token and a manual two-rapid-click scenario keeps only the latest run's state.
- [x] 2.2 Wrap all awaited fetches in the scan startup path (`fetchInventory`, badges-DB `fetchJSON`) with try/catch and defined fallbacks (inventory failure → badge-page scan with `owned` counts; badges-DB failure → badge-page scan or visible terminal error, never a silent hang), verified by reviewing each await site and simulating a rejected fetch to observe fallback/error status.
- [x] 2.3 Isolate `scanPages` progress-radial accounting between the inventory phase and the badge-page phase (reset steps/counters and `full-blue` state at phase boundaries), verified by observing correct radial progression on a badge-page-mode run after the change.
- [x] 2.4 Preserve `tradableCardCounts` semantics (`null` = unknown → `owned` fallback; missing appId → per-badge `owned` fallback; present-but-empty = zero tradable) with no change to the `tradable` flag interpretation (`false`/`0`/`"0"` = held, `market_tradable_restriction` ignored), verified by the unit tests in 3.2 passing.

## 3. Extract testable tradability logic and add unit tests

- [x] 3.1 Create `src/lib/tradable.js` as the single source of truth for `isTradableDescription`, `buildTradableCardCounts`, and the eligibility-mapping helper, wired into `src/ASF-STM.js` via inline build expansion so `dist` stays single-file, verified by `node -e "require('./src/lib/tradable.js')"` (or ESM import) loading without errors.
- [x] 3.2 Add dependency-free unit tests (`node --test`) covering flag variants, foil/non-card exclusion, asset→description counting, held-copy exclusion, the three fallback semantics from 2.4, and unbalanced-eligibility mapping, verified by the documented test command exiting zero.
- [x] 3.3 Document the test command (README or test-file header) so one command runs the suite locally and in CI, verified by running the documented command verbatim from a clean checkout.

## 4. Harden the build and CI (both dist files guaranteed)

- [x] 4.1 Harden `script/build.py` to fail non-zero naming any missing template/placeholder, assert zero unreplaced `{{...}}` tokens, and assert both `dist/ASF-STM.user.js` and `dist/ASF-STM.debug.js` are written with the current version, keeping minification behavior unchanged, verified by a successful build plus a negative check (temporarily remove a template → build fails with the file named).
- [x] 4.2 Extend `.github/workflows/build.yml` to run the unit tests and post-build `dist` verification (both files exist, no placeholders), verified by inspecting the workflow diff and a green CI run.
- [x] 4.3 Bump `src/templates/version` (patch) and regenerate both `dist` files with the hardened build, verified by `git status` showing updated `dist/ASF-STM.user.js` and `dist/ASF-STM.debug.js` containing the new version and no placeholders.

## 5. Final verification

- [x] 5.1 Run the full verification set (`node --test`, `python script/build.py`, placeholder/version checks on both `dist` files) and verify every command passes.
- [x] 5.2 Run `openspec validate --change fix-tradable-filter-first-run --strict` and verify it passes with all four artifacts present.
