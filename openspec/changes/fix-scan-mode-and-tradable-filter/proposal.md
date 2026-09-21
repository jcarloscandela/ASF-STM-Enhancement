# Proposal

## Why

Two user-visible defects break trust in the scan: (1) the persisted `Scan inventory` (`inventoryScan`) option is not honored on the first scan of the day — the run behaves like a badge-page scan instead; (2) card matching and trade-offer creation offer cards that Steam still marks as not yet tradable (e.g. "Tradable After: 26/09/2026, 09:00:00", Alyx Vance Half-Life 2 card), which Steam then omits from the actual offer.

## What Changes

- Harden scan-mode persistence so the executed scan path (inventory scan vs. badge-page scan vs. scan filters) always matches the saved `inventoryScan` / `useScanFilters` settings, including the first click after page load when the bot cache is cold.
- Fix `LoadConfig` default-merge so stored settings round-trip (missing keys get real defaults, stored `inventoryScan=true` is never clobbered to a falsy value).
- Extend tradability detection beyond the current `tradable === false/0/"0"` check to cover time-gated holds ("Tradable After" date): cards whose tradable-after timestamp is in the future count as non-tradable until that date.
- Apply the same tradable-only rule in both places that pick cards: matching/counting (`myBadges` owned counts, eligibility, match rows) and trade-offer creation on the `tradeoffer/new` page (skip held copies when moving items to the trade).
- Update unit tests for the new tradability signals and the config/scan-mode branching; bump version, commit, push, and publish a GitHub release (release steps are part of the change's acceptance, executed in apply phase, not here).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `tradable-card-filter`: scan must start/complete on first invocation in the mode the user saved (inventory vs. badge), and non-tradable copies — including future-dated "Tradable After" holds — are excluded from eligibility, owned counts, and match rows.
- `trade-matching`: tradability determination must recognize time-gated trade holds, and trade-offer creation must only add currently-tradable copies.

## Impact

- Code: `src/ASF-STM.js` (`LoadConfig`, `buttonPressedEvent`/`fetchBots` first-run flow, `prepareInventoryScan`/`getBadgesInventory`/`processFilters` branching, `GetOwnCards` owned-count override, trade-page `addCards` inventory pick), `src/lib/tradable.js` (tradability predicate + counts), `test/tradable.test.js` (+ config/scan-mode tests if harness allows), build output in `dist/`, version bump.
- No API or dependency changes; behavior change is stricter (fewer, but valid, matches). Risk: Steam inventory field names for "Tradable After" vary — design must verify exact fields against live payloads before locking the predicate.
