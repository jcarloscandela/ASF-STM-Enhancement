# Proposal

## Why

Version 1.0.3 broke the scan-source setting: enabling "Scan inventory", saving, and reloading still runs the badge-page scan. Users cannot switch to inventory mode, so the inventory path is effectively dead.

## What Changes

- Audit the current persistence path (`localStorage` keys `TempAsfStm.ASF.STM.Settings/Blacklist/Params`, `LoadConfig`/`SaveConfig`/`ResetConfig`, config-dialog save handler, `mergeWithDefaults`, `resolveScanPlan`/`resolveScanRoute`, `getFirstRadialName`) and document why a saved `inventoryScan=true` does not take effect.
- Reimplement settings storage as a single versioned store module: typed defaults, safe load (missing/corrupt → defaults), merge that preserves explicit `false`/`0`, atomic save after dialog confirm, and full reset that clears all known keys then restores defaults.
- Make the scan dispatcher read the persisted snapshot (not live dialog state) so `inventoryScan=true` reliably routes to inventory mode, and the dialog checkbox reflects the stored value on every open.
- Add fixture coverage for save → reload → dispatch round-trips, corrupt/partial storage, and reset semantics.

## Capabilities

### New Capabilities
- `settings-storage`: persisted userscript settings lifecycle — load, merge with defaults, save, reset, and scan-source dispatch contract.

### Modified Capabilities
- None (no existing spec covers settings persistence; `trade-matching` describes matching behavior, not the settings store).

## Impact

- Code: `src/ASF-STM.ts` (`LoadConfig`/`SaveConfig`/`ResetConfig`, dialog save handler, scan dispatch), `src/lib/settings.ts`, `src/templates/configDialogTemplate.ts`, `test/settings.test.ts` + new round-trip fixtures.
- No new runtime dependencies; storage stays `localStorage`-based (Tampermonkey `GM_getValue`/`GM_setValue` not required).
- Behavior change: reset now clears all `TempAsfStm.ASF.STM.*` keys and restores defaults (previously blacklist was preserved and params untouched).
