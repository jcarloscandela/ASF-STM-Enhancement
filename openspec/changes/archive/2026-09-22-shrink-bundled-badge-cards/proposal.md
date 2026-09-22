# Proposal

## Why

The regenerated `data/badge_cards.json` (~5.3 MB, 1685 games, long keys + full icon URLs) bloats the Tampermonkey/GreasyFork bundle past a comfortable size. The publish artifact must stay small while `data/` keeps its readable model.

## What Changes

- Keep `data/badge_cards.json` in its current readable shape (long keys `size`/`name`/`cards`, `hash`/`title`/`iconUrl`, full icon URLs) as the authoring source.
- Add a build-time compaction step (rolldown plugin or pre-bundle transform) that converts the dataset to a minimal publish encoding before inlining.
- Extend `normalizeDataset` to decode the new publish encoding; keep backward compatibility with current shapes.
- Add size-budget guardrails (CI check + tests) so future dataset regrowth fails loudly.

## Capabilities

### New Capabilities

- `bundled-dataset-publish`: compact publish encoding + build-time compaction + runtime decode of the bundled card dataset.

### Modified Capabilities

- `userscript-build`: build output must embed the compacted dataset and enforce the publish size budget.

## Impact

- `data/badge_cards.json` (unchanged format, still source of truth), `rolldown.config.ts` (compaction plugin), `src/lib/dataset.ts` (decode new encoding), `test/` (round-trip + budget tests), CI size check.
