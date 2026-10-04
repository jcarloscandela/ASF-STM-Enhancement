# Proposal

## Why

The Dataset-tab "Download new badge cards" button currently downloads only the not-yet-bundled diff, but maintainers expect a drop-in `badge_cards.json` replacement that grows on every export. Merging a diff-only file by hand is error-prone and contradicts the filename, which matches the full authoring archive at `data/badge_cards.json`.

## What Changes

- Change the `badge_cards.json` download to contain the full merged archive: every bundled entry plus the newly learned entries, serialized in the existing authoring format.
- Keep new-entry detection, button enable/disable logic, count text, and filename unchanged: the button still activates only when at least one new entry exists.
- Resolve overlaps deterministically: bundled rich entries win; a bundled size-only entry is upgraded when the cache holds its full card list; otherwise the bundled entry is kept verbatim.
- Keep the export side-effect free (no cache, dataset, or scan-behavior changes) and keep the output loadable via `normalizeDataset`.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `badge-cards-export`: download payload changes from exactly-the-new-entries to the full merged archive (bundled + new), including overlap resolution and round-trip guarantees.

## Impact

- Affected code: `src/lib/dataset-export.ts` (export payload assembly), possibly `src/lib/dataset.ts` (merge/serialize helper), config-dialog wiring in `src/ASF-STM.ts` / `src/templates/`, and `test/dataset-export.test.ts` + `test/dataset.test.ts` fixtures.
- No new dependencies, no API or storage-format changes; browser cache key and bundled compact publish encoding unchanged.
- Docs sync per repo rules: `AGENTS.md` / `README.md` Dataset-tab wording must change from "only new entries" to "full merged archive" in the same change, plus a patch version bump.
