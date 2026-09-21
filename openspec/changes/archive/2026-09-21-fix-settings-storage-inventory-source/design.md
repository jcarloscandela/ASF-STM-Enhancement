# Design

## Context

See proposal.md (Why). Current state (observed in `src/`): storage is plain `localStorage` — **yes, localStorage is in use**, keys `TempAsfStm.ASF.STM.Settings/Blacklist/Params/BotCache` (`src/ASF-STM.ts:446-476`). Load merges stored over `defaultSettings` via `mergeWithDefaults` (`src/lib/settings.ts:34-47`); dispatch reads `resolveScanPlan` snapshot (`src/lib/settings.ts:60-85`) plus `globalSettings.inventoryScan` in `getFirstRadialName` (`src/ASF-STM.ts:524-531`). Audit suspects for the reported symptom: (1) dialog save may write a stale/mutated object or fail to persist before close; (2) `LoadConfig` blacklist `JSON.parse` without try/catch can throw and abort load; (3) `ResetConfig` preserves blacklist and never clears keys; (4) possible key mismatch/double-source of truth between dialog checkbox and `globalSettings`. The reimplementation removes these by centralizing the store.

## Goals / Non-Goals

**Goals:**
- One settings-store module owning keys, defaults, load/merge/save/reset with unit-testable pure functions.
- Deterministic save → reload → dispatch round-trip for `inventoryScan` and all other options.
- Reset semantics per spec (clear all keys, restore defaults, persist).

**Non-Goals:**
- Migrating to `GM_getValue`/`GM_setValue` or cross-device sync.
- Changing matching, tradability, or inventory-fetch logic.
- Version-migration of ancient stored schemas beyond additive merge.

## Decisions

- **Centralize in `src/lib/settings.ts`**: add `SETTINGS_KEY`/key constants, `loadSettings(storage, defaults)`, `saveSettings(storage, settings)`, `resetSettings(storage, defaults)` operating on a `StorageLike` interface — keeps vitest fixture coverage without browser, thin wrappers in `ASF-STM.ts` pass real `localStorage`. Alternative (inline fixes in `ASF-STM.ts`): rejected, untestable and repeats the current sprawl.
- **Snapshot dispatch**: capture `resolveScanPlan(globalSettings)` once at scan start and thread it through; `getFirstRadialName` takes the snapshot instead of rereading globals. Alternative (reread live settings mid-run): rejected, source of the badge/inventory mismatch.
- **Merge rule unchanged** (stored wins incl. `false`/`0`, missing keys get defaults, corrupt → defaults) — already correct in `mergeWithDefaults`; add boolean coercion audit for `inventoryScan` (accept `true`/`"true"`/`1`?) — decision: strict boolean, coerce truthy strings only if fixtures show Steam/TM writes them; default strict.
- **Reset clears all four keys** then saves defaults (breaking blacklist preservation — spec'd, user requested).

## Risks / Trade-offs

- [Risk] Users relying on blacklist surviving reset lose it → Mitigation: call it out as **BREAKING** in release notes; blacklist export unchanged.
- [Risk] Checkbox `checked` attribute vs property desync in dialog template → Mitigation: render from loaded settings each open; round-trip test asserts dialog HTML contains `checked` after save+reload.
- [Risk] `localStorage` unavailable (private mode) throws → Mitigation: try/catch on all access, fall back to in-memory defaults.

## Migration Plan

- No data migration: additive merge handles older stored objects (missing keys → defaults); unknown keys preserved.
- Rollback: revert to prior `LoadConfig`/`SaveConfig`; stored JSON format is unchanged so rollback is safe.

## Open Questions

- None blocking; strict-vs-coercive boolean parsing to be settled by fixture probe during implementation.
