# Proposal

## Why

With "Scan inventory" enabled, starting a scan still walks the badge pages (`/badges?p=N`) instead of deriving owned badges directly from the Steam inventory. The badge-page path is much slower (paginated HTML per page + per-badge detail) and defeats the purpose of the inventoryscan option.

## What Changes

- When the resolved scan plan is `inventory` mode, the scanner SHALL NOT fetch badge pages; it SHALL derive badge stubs from the fetched inventory via `buildTradableCardCounts` + `buildScanEligibility`.
- Remove/scope the silent fallback from inventory mode to `getBadges(1, ...)` when tradability data is missing: surface the failure (abort with message / explicit opt-in fallback) instead of silently running the slow badge scan.
- Keep `filters` mode precedence unchanged (filters still win over inventory mode).
- Keep badge-page scan as the explicit path only when inventory scan is disabled (mode `badges`).

## Capabilities

### New Capabilities

- None (behavior fix within existing capability).

### Modified Capabilities

- `trade-matching`: inventory-mode scan source changes from badge pages to inventory-derived eligibility; fallback-on-unknown-tradability behavior changes.

## Impact

- `src/ASF-STM.ts`: `getBadgesInventory`, `prepareInventoryScan`, `buttonPressedEvent`/`fetchBots` scan-plan flow, progress radials ("Inventory Pages" vs "Badge Pages").
- `src/lib/settings.ts`: `resolveScanPlan` mode semantics (no code change expected, but spec reference).
- `src/lib/tradable.ts`: `buildTradableCardCounts` / `buildScanEligibility` contract for inventory-derived stubs.
- Tests in `test/` covering inventory-mode routing and fallback behavior.
