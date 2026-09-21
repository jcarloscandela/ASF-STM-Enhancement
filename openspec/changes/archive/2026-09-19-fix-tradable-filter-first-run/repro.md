# Repro note — first-run scan failure (change: fix-tradable-filter-first-run)

Traced statically in `src/ASF-STM.js` (commit `0ccba07`, v6.0.0.13). No live Steam page
available here, so triggers are confirmed by code-path analysis, not a browser repro.
All line numbers refer to `src/ASF-STM.js` at `0ccba07`.

## Confirmed triggers (each sufficient to produce "fails first, works on retry")

- **T1 — Unhandled badges-DB rejection stalls the scan silently.**
  `prepareInventoryScan()` calls `getBadgesInventory(inventoryData)` without
  `await`/`.catch` (line 1621). Inside, `await fetchJSON(badges.min.json)` (line 1420)
  uses bare `GM_xmlhttpRequest` with no fallback. Any rejection (transient network,
  non-2xx, JSON parse error, `GM_xmlhttpRequest` undefined in managers that only
  expose `GM.xmlHttpRequest`) becomes an unhandled promise rejection: no fallback to
  `getBadges(1)`, no `stopEventCleanup`, UI left mid-scan. Clicking Scan again retries
  and succeeds when the transient cause is gone. Console: `Uncaught (in promise)`.
- **T2 — `scanPages` radial state leaks between phases.**
  `fetchInventory()` sets `progressRadials.scanPages.steps` and calls
  `updateProgress('scanPages')` (lines 1303-1306), then forces `steps = 1` +
  `full-blue` + one more `updateProgress` on completion (lines 1316-1320).
  `getBadges(1)` reuses the same radial on page 1 without resetting `currentStep`
  or removing `full-blue` (lines 1153-1159), so the counter starts mid-way and the
  radial can show ✓ prematurely. Cosmetic but user-visible on every badge-page run.
- **T3 — Stale async completion overwrites the newer run.**
  There is no run token. `buttonPressedEvent` resets `tradableCardCounts = null`
  (line 1662) and launches `prepareInventoryScan()` (line 1667). A slow first-run
  `fetchInventory()` (multi-page, `inventoryScanDelay` sleeps) resolving after the
  user clicks Scan a second time writes `tradableCardCounts` (line 1614) and starts
  `getBadges(1)`/`getBadgesInventory` into the middle of the newer run's state.
- **T4 — Pre-existing bots-cache two-step (not a regression, noted for triage).**
  When the bot cache is stale, the first click only calls `fetchBots()` and returns
  (lines 1636-1640); the scan starts on the recursive `buttonPressedEvent()` from
  the bots callback. If the reporter counts "nothing visible happened" as a failure,
  T4 alone explains it. Out of scope for this change; recorded here so the fix can
  be told apart from it during verification.

## Scan-mode matrix (all four combos route through the new upfront fetch)

| inventoryScan | scan filters active | Startup path after `0ccba07` | Affected by |
|---|---|---|---|
| off | off | `prepareInventoryScan` → `fetchInventory` → `getBadges(1)` | T1 only if inventory fetch fails (caught, falls back); T2, T3 |
| off | on | `prepareInventoryScan` → `fetchInventory` → `getBadges(1)` → `processFilters` → `GetOwnCards` | T2, T3 (+T1 class, caught) |
| on | off | `prepareInventoryScan` → `fetchInventory` → `getBadgesInventory` (uncaught `await`) | T1, T2, T3 |
| on | on | `prepareInventoryScan` → `fetchInventory` → `getBadgesInventory` → `processFilters` early-return | T2, T3 (+T1 class only if `processFilters` false) |

Note: before `0ccba07`, badge-page mode never touched the inventory endpoint or the
badges DB, so T1/T2/T3 are regressions of that commit; T4 predates it.
