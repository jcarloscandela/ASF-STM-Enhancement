# Design

## Context

See `proposal.md` (Why) and `specs/*/spec.md` for requirements. Current state (observed in `src/ASF-STM.js`, `script/build.py`):

- Commit `0ccba07` added `tradableCardCounts`, `isTradableDescription`, `buildTradableCardCounts`, and `prepareInventoryScan`, which **always** calls `fetchInventory()` before either scan path — including badge-page mode, which previously never touched the inventory endpoint.
- `prepareInventoryScan` calls `getBadgesInventory(inventoryData)` **without await/catch**; `getBadgesInventory` itself awaits the badges-DB fetch with no fallback, so a rejection becomes an unhandled rejection and the scan silently stalls on that run.
- `fetchInventory` mutates the `scanPages` progress radial (sets `steps`, calls `updateProgress`, forces `full-blue` on completion) and `getBadges(1)` then reuses the same radial — progress state leaks between phases and between consecutive runs.
- There is no run token: a slow first-run `fetchInventory` can resolve after the user clicks Scan again (or after Stop), overwriting `tradableCardCounts` mid-scan of the newer run.
- `tradableCardCounts` semantics conflate "unknown, fall back to owned" (`null`) with "known" (object); `GetOwnCards` already falls back per-appId when the appId key is absent — that behavior must be preserved.
- No tests exist; `script/build.py` writes both `dist` files but never validates missing templates, unreplaced placeholders, or failures. CI builds but does not test or verify outputs.

## Goals / Non-Goals

**Goals:**

- First click reliably scans in all modes; failures always surface as a visible terminal status or a defined fallback, never a silent stall.
- Tradable filtering keeps its current semantics (flag interpretation, foil/non-card exclusion, per-appId owned fallback) while becoming deterministic across runs.
- One build command guarantees both `dist` files; one test command verifies logic; CI enforces both.
- Keep the diff small: no matcher-algorithm changes, no UI redesign, no new runtime dependencies.

**Non-Goals:**

- Foil-card matching, duplicate-list features, or new scan modes.
- Migrating the userscript to modules/bundlers, or restructuring templates.
- Fixing the pre-existing `LoadConfig` validation typo (`defaultSettings[defaultSettings]`) unless it blocks this change — recorded as a follow-up, not done here.

## Decisions

### 1. Keep one upfront inventory attempt, but make it non-blocking-by-contract and race-safe

**Choice:** `prepareInventoryScan` remains the single entry point, but (a) every awaited fetch (`fetchInventory`, badges-DB `fetchJSON`) is wrapped in try/catch with a defined fallback (inventory-scan → badge-page scan; badges-DB failure → badge-page scan or visible error, never a hang); (b) a monotonic run token captured at `buttonPressedEvent` invalidates stale async completions (late `fetchInventory` results are discarded if the token moved or `stop` was set); (c) inventory-phase radial updates use a separate accounting reset before the badge-page phase starts instead of sharing `currentStep`.

**Alternatives considered:** fetch inventory only when `inventoryScan` is on (rejected — badge-page `GetOwnCards` legitimately uses the tradable override, so both modes benefit); run inventory fetch in parallel with badge pages and merge late (rejected — larger concurrency change than the "don't change a lot" constraint allows; the token-guarded sequential attempt is sufficient).

### 2. Single source of truth for pure tradability logic, still shipped as one file

**Choice:** new `src/lib/tradable.js` holding `isTradableDescription`, `buildTradableCardCounts`, and the eligibility-mapping helper; `src/ASF-STM.js` references them via a `{{TRADABLE_LIB}}` placeholder that `script/build.py` expands inline, so `dist` artifacts remain single-file userscripts. Node tests import `src/lib/tradable.js` directly with zero dependencies (`node --test`).

**Alternatives considered:** copying function bodies into the test file (rejected — drifts from shipped code); regex-extracting functions from `ASF-STM.js` at test time (rejected — fragile); introducing npm/bundler (rejected — contradicts minimal-change constraint; repo has no `package.json`).

### 3. Preserve `null` vs object vs empty-appId semantics explicitly

**Choice:** `tradableCardCounts === null` means "unknown → use badge-page `owned`"; an appId key absent means per-badge fallback to `owned`; an appId key present with an empty map means "known, zero tradable". Unit tests pin all three, including `tradable` flag variants (`false`, `0`, `"0"` → held) and `market_tradable_restriction` explicitly ignored.

### 4. Harden `script/build.py` without changing minification

**Choice:** build fails non-zero naming the missing template/placeholder; after expansion it asserts zero remaining `{{...}}` tokens and that both output files were written with the current version string. Minifiers and template behavior are untouched.

**Alternative considered:** rewriting the build in Node (rejected — Python build works and CI already uses it).

### 5. CI verifies tests + both artifacts

**Choice:** extend `.github/workflows/build.yml` with `node --test` and a post-build assertion (both `dist` files exist, no placeholders). No new CI services or secrets.

## Risks / Trade-offs

- [Risk] Steam inventory/badges-DB response shapes change → Mitigation: pure helpers take narrow inputs; tests use fixture-shaped data; fetch failures always fall back instead of stalling.
- [Risk] Run-token guard discards a legitimately slow inventory result → Mitigation: that is the defined behavior (stale run loses); the active run's own fetch still applies normally.
- [Risk] Extracting helpers into `src/lib/tradable.js` touches the shipped file's placeholder area → Mitigation: build-time inline expansion keeps `dist` single-file; tests plus placeholder validation catch expansion errors.
- [Risk] Native `fetch` vs `GM_xmlhttpRequest` reliability differences in Tampermonkey → Mitigation: error paths treat both uniformly (fallback + visible status); no new request mechanism introduced.
- [Trade-off] Badge-page mode still pays one inventory fetch before badge pages (extra latency on large inventories) in exchange for correct tradable counts; failure degrades to current owned-count behavior rather than blocking the scan.

## Migration Plan

- Ship as a normal userscript update (patch version bump in `src/templates/version`); `dist` files regenerated by the hardened build.
- Rollback: revert `src/ASF-STM.js`, `src/lib/tradable.js`, `script/build.py`, version bump; previous behavior (with the first-run bug) is restored — no data migration involved (localStorage keys unchanged).

## Open Questions

- None that block specs, approach, or tasks. One deferrable diagnostic: if the reporter's "first execution fails" turns out to be the pre-existing bots-cache two-click flow (`fetchBots` → recursive `buttonPressedEvent`) rather than the tradable-fetch stall, implementation should confirm via console repro and note it, without expanding scope.
