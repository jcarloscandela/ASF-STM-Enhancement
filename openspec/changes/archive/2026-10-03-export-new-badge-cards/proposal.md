# Proposal

## Why

Scans learn new card data into the browser cache (`TempAsfStm.ASF.STM.BadgeCards.v1`), but getting those entries back into `data/badge_cards.json` for the next release is manual and error-prone. An export button that downloads only the newly learned entries closes that loop, so each release can fold real scan results into the bundled dataset.

## What Changes

- Add a config-dialog "Download new badge cards" button that exports cache entries not yet covered by the bundled dataset as a `badge_cards.json` file in authoring format (long keys `size`/`name`/`cards` + `hash`/`title`/`iconUrl` with full icon URLs), ready to merge into `data/badge_cards.json` for a new version.
- The button is disabled when there are zero new entries and enabled when at least one exists; state recomputes on dialog open and after scans that learn entries.
- Download contains only the new entries, never the whole cache or dataset.
- Add the requested contributor rule to `AGENTS.md`: never read `badge_cards.json` or the badge-cards cache whole — sample the first ~20 entries/rows instead, to avoid wasting tokens on a huge dataset.
- Assumptions (confirm at review): "new" means a cached appId with no bundled entry, or a bundled size-only entry where the cache holds a full card list; the browser cannot overwrite the repo file, so "overwrite the json" is a manual merge of the downloaded file into `data/badge_cards.json`.

## Capabilities

### New Capabilities

- `badge-cards-export`: export of newly learned badge-card cache entries as a merge-ready `badge_cards.json` download, with empty-state disabled behavior.

### Modified Capabilities

- None — learning, caching, dataset publish, and scan behavior are unchanged; this change only reads the cache and bundled dataset.

## Impact

- Affected code: `src/lib/dataset.ts` (pure diff/export helpers), `src/ASF-STM.ts` (thin wiring: state refresh, download trigger), `src/templates/configDialogTemplate.ts` (button markup), `test/` fixture suites for the diff/export rules.
- Docs: `AGENTS.md` (20-entry sampling rule + export/merge workflow); `README.md` dataset section if it documents the workflow.
- No API, dependency, matching, offer, or persistence-format changes. No change to what is learned or when.
