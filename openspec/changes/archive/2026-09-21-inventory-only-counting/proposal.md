# Proposal

## Why

The scanner currently supports three scan paths (scan filters, inventory API, badge pages) selected by the persisted `inventoryScan` flag, but the badge-page crawl is slow, fragile, and redundant now that the inventory-API path is stable and aborts visibly on failure. Making the inventory API the default (and only non-filter) scan path removes a slow mode, simplifies the config dialog, and eliminates a whole class of "wrong mode saved" support issues.

## What Changes

- **BREAKING**: Remove the badge-page scan as a selectable scan mode. The badge-page crawl (`getBadges`) and the `badge` scan-plan mode are removed; the inventory API is the default path for every scan.
- **BREAKING**: Remove the "Scan inventory" checkbox from the config dialog. The setting no longer exists as a user option; a stored `inventoryScan` value is ignored (kept harmlessly in storage, never read for dispatch).
- Keep the "Inventory scan delay (ms)" setting and its config-dialog input; it continues to pace the paged inventory fetch.
- Keep scan filters with their existing precedence: active scan filters still divert the run into the filters path before the inventory scan.
- `resolveScanPlan` reduces to two outcomes: `filters` (enabled with at least one active filter) or `inventory` (always otherwise). The `badge` mode and the `inventoryScan` flag in `ScanPlan` are removed.
- Update inventory-scan failure messages that currently suggest "disable inventory scan to use badge pages" — that escape hatch no longer exists; failures abort with a retry suggestion only.
- Reset still restores defaults; the defaults no longer include `inventoryScan`.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `scanner-config`: The "scan path resolves deterministically" requirement changes from a three-way choice (filters / inventory / badge) to a two-way choice (filters / inventory); the inventory scan is the unconditional default and the badge-page scenario is removed.
- `settings-storage`: The dispatch requirement no longer branches on the persisted `inventoryScan` flag; the "Scan inventory" checkbox scenario and the badge-mode dispatch scenario are removed, and reset/default scenarios no longer reference `inventoryScan=false`.
- `tradable-card-filter`: The first-run and degradation requirements no longer describe a badge-page mode; the inventory path is the only non-filter path, and the badge-page fallback scenario for a failed upfront inventory fetch is removed (failure aborts instead).

## Impact

- `src/lib/settings.ts` — `ScanPlan` type, `resolveScanPlan` (drop `badge` mode and the `inventoryScan` flag), defaults, schema keys.
- `src/lib/models.ts` — `GlobalSettings` shape (`inventoryScan` removed; `inventoryScanDelay` stays).
- `src/ASF-STM.ts` — remove `getBadges` and badge-mode branches in `prepareInventoryScan` / `buttonPressedEvent` / `getBadgesInventory`; update debug output and abort messages; keep `fetchInventory`, `getBadgesInventory`, `GetOwnCards`.
- `src/templates/configDialogTemplate.ts` — remove the "Scan inventory" checkbox row (keep the delay input); adjust the grid layout.
- `test/settings.test.ts` and related fixtures — rewrite scan-plan and route tests for the two-mode model; update store round-trip tests that assert badge dispatch.
- Existing users upgrading keep their other settings; a stored `inventoryScan` key is simply ignored (no migration needed since the key is not re-saved after the change).
- No new dependencies; version bump required per repo rules.
