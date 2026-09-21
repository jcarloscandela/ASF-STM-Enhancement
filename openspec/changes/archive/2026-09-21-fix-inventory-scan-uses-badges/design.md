# Design

## Context

See proposal.md (Why). Current flow in `src/ASF-STM.ts`: `buttonPressedEvent` snapshots a `ScanPlan` (`resolveScanPlan` in `src/lib/settings.ts`); inventory mode runs `prepareInventoryScan` → `getBadgesInventory`, which maps inventory → `buildTradableCardCounts` → `buildScanEligibility` to push badge stubs. However `getBadgesInventory` calls `getBadges(1, scanPlan)` when `tradableCardCounts === null`, and any upstream misrouting (plan resolution, `processFilters` guard, retry path via `fetchBots(pendingPlan)`) can land the scan back on the paginated badge-page crawl (`getBadges`), which is the slow path the user observes. Progress radials (`Inventory Pages` vs `Badge Pages` via `getFirstRadialName`) also need to reflect the executed path.

## Goals / Non-Goals

**Goals:**
- Guarantee inventory mode never touches badge pages on the candidate-discovery path.
- Replace silent badge fallback with an explicit abort + message.

**Non-Goals:**
- No change to `filters` mode precedence, bot-side matching, or offer creation.
- No change to badges mode when inventory scan is off.
- No new runtime dependencies.

## Decisions

- **Gate candidate discovery strictly on `scanPlan.mode`**: in `getBadgesInventory` / `prepareInventoryScan`, branch only on the snapshotted plan; `processFilters` keeps precedence for `filters` mode. Alternative (re-resolving settings mid-scan) rejected: it reintroduces mode drift.
- **Explicit abort instead of fallback**: on inventory/badges-DB/tradability failure in inventory mode, call `stopEventCleanup` with an inventory-specific message + `debugPrint`, never `getBadges`. Alternative (opt-in fallback toggle) rejected for scope: adds settings UI; can be a follow-up.
- **Verify no badge-page call sites remain reachable from inventory mode**: audit `getBadges` callers so the only entry is badges mode (and legacy explicit path). Keep `getBadges` function itself untouched.
- **Test at lib + routing level**: fixture tests for `buildTradableCardCounts`/`buildScanEligibility` stub derivation already exist in pattern of `test/tradable.test.ts`; add routing regression tests (plan-gated, no-badge-fetch assertion via stubbed fetch or call spy) following `test/settings.test.ts` conventions. No browser/network in tests.

## Risks / Trade-offs

- [Risk] Users with failing inventory endpoint now see an abort instead of slow-but-working badge results → Mitigation: clear error message stating inventory scan failed and suggesting retry or disabling inventory scan.
- [Risk] Run-id/supersede logic (`scanRunId`, `stop`) interacts with new abort path → Mitigation: abort only when `runId` is current; keep existing supersede early-returns.
- [Risk] Progress radial stuck on "Inventory Pages" on abort → Mitigation: reset/mark radial state in the abort path consistent with `stopEventCleanup`.

## Migration Plan

- Userscript-only change; no data migration. Rollback: revert to prior `dist/` build. Bump `package.json` patch per repo versioning rule at implementation time.
