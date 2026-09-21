# Proposal

## Why

The bundled `data/badge_cards.json` (5.3 MB raw, inlined into the ~5 MB userscript) stores all 11,025 card icon URLs in full, even though every one shares the same CDN-prefix bytes; and the repo ships two dataset files whose roles are unclear. Shrinking the bundle speeds Tampermonkey installs/updates and clarifies the data pipeline.

## What Changes

- Answer on `card_counts`: it stays — it covers 209 games that `badge_cards` does not (1,675 appIds overlap), providing set sizes for eligibility with no network. But it is folded into the single `badge_cards` file as size-only entries, so there is one bundled dataset file and one import instead of two.
- Compress the bundled encoding (byte-identical runtime behavior):
  - Strip the constant icon-URL prefix (measured: all 11,025 icons share the leading ~80 bytes: the `https://community.fastly.steamstatic.com/economy/image/` CDN base plus a common hash prefix) at export time; re-attach a single shared constant at load. Saves roughly 0.5 MB raw (~10% of the file).
  - Shorten JSON keys (`size`/`cards`/`hash`/`title`/`iconUrl` → compact keys) while `normalizeDataset` keeps accepting the current long-key shape (backward-compatible export regeneration).
- Regenerate `data/badge_cards.json` from the steam-cards-bot export in the new encoding; delete `data/card_counts.json`; update the single import in `src/ASF-STM.ts`.
- Update `AGENTS.md`/`README.md` dataset docs and the affected spec (see Capabilities).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `trade-matching`: the bundled-datasets requirement changes from "two datasets SHALL be bundled" (badge-cards + card-counts with precedence rules) to "one compact dataset SHALL be bundled" (rich entries plus size-only entries, prefix-stripped icon paths reconstructed at load with identical resolved values).

## Impact

- Data: `data/badge_cards.json` regenerated (compact encoding, absorbs counts-only games); `data/card_counts.json` deleted.
- Code: `src/ASF-STM.ts` (single dataset import), `src/lib/dataset.ts` (prefix reconstruction + short keys, backward-compatible normalize), `test/` fixtures for the compact encoding.
- Docs: `AGENTS.md`, `README.md` dataset sections.
- No matching, scan, display, or distribution behavior changes; resolved dataset values are byte-identical.
