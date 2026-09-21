# Design

## Context

See proposal.md Why. Measured facts: `data/badge_cards.json` (5.34 MB, 1,676 games, 11,025 icons) and `data/card_counts.json` (70 KB array export, 1,884 games) overlap on 1,675 appIds, with 209 counts-only games folding in as size-only entries. All 11,025 icon URLs share the leading ~80 bytes (CDN base + common hash prefix). Both files are inlined into `dist/ASF-STM.user.js` via JSON imports in `src/ASF-STM.ts:34-35` and normalized by `normalizeDataset`; per-game precedence is resolved by `resolveBadgeSize`/`resolveBadgeCardList` (`src/ASF-STM.ts:1345-1370`).

## Goals / Non-Goals

**Goals:**
- One bundled dataset file in a compact encoding that resolves to byte-identical runtime values, with a measurably smaller `dist` file.

**Non-Goals:**
- No change to matching, scanning, display, eligibility, or distribution behavior; no change to the browser-persisted cache format (runtime data, not bundle size); no change to the steam-cards-bot export schema itself.

## Decisions

- **Merge counts-only games into `badge_cards.json` as size-only entries** over keeping two files. Rationale: one file, one import, one resolution path; the rich entry still wins on the 1,675 overlapping games. Alternative (keep both) preserves a redundant two-file precedence layer for 209 extra games' worth of coverage that folds in cleanly.
- **Strip the constant icon-URL prefix at export, re-attach one shared constant at load** over generic minification. Rationale: ~0.57 MB raw saving from a single safe string operation; minifiers cannot exploit cross-string redundancy. The common hash-prefix bytes beyond the CDN base are included only if the export script verifies them constant across the whole file on every regeneration.
- **Short compact keys with backward-compatible `normalizeDataset`** over a breaking format. Rationale: `normalizeDataset` already accepts multiple shapes, so accepting both long and short keys keeps old exports loadable and makes the change reviewable as data-only plus a small loader diff. Alternative (in-place key rename without compat) would break regeneration from older exports.
- **Byte-identical resolved values as the acceptance gate** (round-trip test: compact decode equals current decode for every game) over size-target gating. Rationale: correctness is binary here; size is reported, not asserted.

## Risks / Trade-offs

- [Risk] A future export changes the CDN host or hash shape, silently breaking prefix reconstruction → Mitigation: export/regeneration step asserts the prefix across all icons and fails loudly on mismatch; a fixture pins the constant.
- [Risk] Regenerated file drifts from the steam-cards-bot source (manual export step) → Mitigation: tasks record the exact export+encode commands in `AGENTS.md`/`README.md` so regeneration is reproducible.
- [Risk] Short keys hurt data-file readability → Mitigation: accepted trade-off, documented in the dataset docs; loader compat keeps the mapping explicit in code.

## Migration Plan

Land data + loader + docs + patch bump together; CI rebuilds and verifies `dist`. Rollback is a version revert. GreasyFork/Tampermonkey users update normally; the browser cache format is untouched so learned entries survive.
