# Tasks

## 1. Storage audit

- [x] 1.1 Document the load/save/reset/dispatch path with file:line references and the root cause of the inventory-flag loss, verified by re-reading `src/ASF-STM.ts` and `src/lib/settings.ts`
- [x] 1.2 Probe boolean coercion and blacklist `JSON.parse` throw cases with a scratch vitest run, verified by recorded findings in the change notes

## 2. Store reimplementation

- [x] 2.1 Add versioned key constants plus `loadSettings`/`saveSettings`/`resetSettings` on a `StorageLike` interface in `src/lib/settings.ts`, verified by `pnpm typecheck`
- [x] 2.2 Rewire `LoadConfig`/`SaveConfig`/`ResetConfig` and the dialog save handler in `src/ASF-STM.ts` to the new store with try/catch and atomic save, verified by `pnpm typecheck` and `pnpm lint`
- [x] 2.3 Snapshot the scan plan at scan start and thread it through dispatch and `getFirstRadialName`, verified by `pnpm typecheck`

## 3. Coverage and release gates

- [x] 3.1 Add round-trip fixtures (save → reload → dispatch routes inventory; explicit false preserved; corrupt/missing → defaults; reset clears all keys and restores defaults) in `test/settings.test.ts`, verified by `pnpm test`
- [x] 3.2 Run full gates `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, and bump `package.json` patch version per AGENTS.md MUST rules, verified by clean command outputs

## Audit findings (task 1.1)

Current path, read from `src/ASF-STM.ts` and `src/lib/settings.ts` at HEAD
`e9c4a5c` (line numbers from that revision):

- **Load** — `LoadConfig` (`src/ASF-STM.ts:301-309`): `readJson` (safe, corrupt →
  `null`) from `STORAGE_KEYS.settings`, then `mergeWithDefaults(stored,
  defaultSettings)` (`src/lib/settings.ts:89-104`). Merge itself is correct:
  stored wins including explicit `false`/`0`, missing keys backfill, wrong-typed
  values fall back **per key** via `validateAgainstDefault`
  (`src/lib/settings.ts:65-82`).
- **Save** — `SaveConfig` (`src/ASF-STM.ts:296-299`): `writeJson` settings +
  blacklist. The dialog save handler (`src/ASF-STM.ts:247,279`) writes
  `globalSettings.inventoryScan = <checkbox>.checked` **before** `SaveConfig()`,
  so the persisted value reflects the dialog.
- **Dispatch** — `buttonPressedEvent` (`src/ASF-STM.ts:1524-1530`) snapshots
  `resolveScanPlan(globalSettings)` once; `resolveScanPlan`
  (`src/lib/settings.ts:117-142`) routes filters > inventory > badge.
  `getFirstRadialName` (`src/ASF-STM.ts:368-375`) re-reads live globals instead
  of the snapshot.
- **Reset** — `ResetConfig` (`src/ASF-STM.ts:291-294`) only replaces
  `globalSettings` in memory: the stored `inventoryScan: true` is **not
  cleared**, so the next `LoadConfig` restores the pre-reset value. Blacklist is
  preserved and no key is deleted.

**Root cause of the reported symptom** ("enable Scan inventory, save, reload →
still badge pages"): after the earlier changes the save→load→dispatch chain is
actually correct for a plain save/reload (verified by `test/scanner-config.test.ts`
round-trip fixtures). The remaining defect is **reset**: `ResetConfig` restores
defaults in memory only and leaves `TempAsfStm.ASF.STM.Settings` on disk, so any
user who ever toggled inventory *off→on* and later hit "restore default settings"
gets the stored value re-applied on the next load — the dialog then shows
`inventoryScan` back at its stored (not default) value, and reload after reset
looks like the flag "lost" the user's last save. Reset not clearing keys is the
gap the spec's reset requirement targets.

## Probe findings (task 1.2)

Recorded from scratch vitest run (`test/__probe.test.ts`, deleted after):

- **Boolean coercion is strict already**: `mergeWithDefaults` accepts only real
  booleans for boolean keys. `inventoryScan: true → true`; every other variant
  (`"true"`, `1`, `"1"`, `"yes"`, `0`, `"false"`, `null`) falls back to the
  default `false` — consistent with the design's "default strict" decision, so
  **no coercion change is needed**.
- **Blacklist `JSON.parse` can throw** on `"not json"` and `""` — but the current
  `LoadConfig` already routes through `readJson`, which catches parse errors and
  falls back to `[]`. The historical throw path is already closed; the fixtures
  below pin that behavior.
- Corrupt-JSON handling in `readJson` returns the fallback (verified: `"not json"`
  → fallback, `"null"` → fallback since a stored `null` is treated as absent).
