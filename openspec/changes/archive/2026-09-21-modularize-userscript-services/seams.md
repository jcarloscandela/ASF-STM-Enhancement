# Seam map 1.3: every named function in `src/ASF-STM.ts`

Classes: **pure** (extractable to `src/lib`, plain-fixture tests),
**harness** (needs happy-dom canned DOM, no network),
**shell** (thin host wiring: XHR/GM/unsafeWindow/cookie/timers, stays inline).

## Debug / config UI

- `debugTime`, `debugTimeEnd`, `debugPrint` → pure (injectable logger seam already exists in lib).
- `createScanFilterElement`, `createSortSelect` → pure (string builders).
- `ShowConfigDialog` → harness (dialog HTML) + shell (`unsafeWindow.ShowConfirmDialog`).
- `ResetConfig`, `SaveConfig`, `LoadConfig`, `SaveParams`, `LoadParams`,
  `AddScanFilter`, `ResetScanFilters` → pure w/ injected storage (lib pattern exists).
- `enableButton`, `disableButton`, `updateProgress`, `resetRadials`,
  `filterAllEventHandler`, `checkRow` → harness.
- `getFirstRadialName` → pure.
- `blacklistEventHandler`, `filterEventHandler`, `filterSwitchesHandler`,
  `filtersButtonEvent`, `stopButtonEvent`, `stopEventCleanup`,
  `addScanFilterEventHandler`, `clearScanFiltersEventHandler` → harness + shell.

## Match rows (slice 2.4)

- `populateCards`, `compareNames` → pure.
- `addMatchRow` → harness; its view-data/filter-update core → pure.
- `compareCards` wrapper → shell (core already pure in `matcher-core`).
- `storeMatches` wrapper → shell (core already pure in `matcher-core`).

## Own-cards scan

- `GetOwnCards`, `fetchNext`, `finish`, `prepareInventoryScan`,
  `buttonPressedEvent` → orchestrator shells (sequence XHR/DOM/retries).
- `fillCards`, `learnBadgeCards` → pure (+ storage seam).
- `processFilters` → pure decision.
- `resolveBadgeSize`, `resolveBadgeTitle`, `resolveBadgeCardList`,
  `resolvedBadgeCardData` → pure (dataset-backed).
- `getBadgesInventory` → pure over `InventoryData`.
- `fetchInventory`, `updateScanFilterAppName` → network shells (faked seams in tests).
- `abortInventoryScan` → shell.

## Bot-cards scan (slices 2.1-2.3)

- `GetCards` → orchestrator shell; parsing core → pure:
  - gamecards-page parse (quantities, titles, icons, unmatched) → pure (2.1).
  - flat-badge predicate (own :848 + bot :1156) → pure (2.2).
  - bot-badge builder (exact/suffix hash map, skip path) → pure (2.3).
- `botSorter` → pure.

## Trade offer page (slice 2.5)

- `getUrlVars` → pure (location-string seam).
- `getRandomInt`, `mySort` → pure.
- `restoreCookie` → harness (cookie jar).
- `addCards` → harness; selection planner (order, tradable skip, aborts) → pure.
- `checkContexts` → harness (readiness polling with faked users).

## Coverage conclusion

All ~55 named functions mapped; anonymous callbacks belong to their parent
shell. Pure extraction (2.1-2.5) covers parsing/decisions; harness suites
(3.1) cover DOM/readiness/cookie paths; network shells stay thin with faked
seams and are covered only at their pure decision branches. No behavior
change anywhere: golden tests per slice.
