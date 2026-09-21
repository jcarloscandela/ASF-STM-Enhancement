# Design

## Context

The scanner already resolves badge data through a layered chain (`src/ASF-STM.ts`, `resolveBadgeSize` / `resolveBadgeTitle` / `resolveBadgeCardList` / `resolvedBadgeCardData`): bundled `card_counts.json` → browser cache (`TempAsfStm.ASF.STM.BadgeCards.v1`) → lazy remote badges DB → serial `ajaxgetbadgeinfo`. `src/lib/dataset.ts` owns the types and normalization; `resolveBadgeEntry` maps bundled card hashes to `{ hash }`-only slots, so bundled-only games render without titles or icon artwork until a detail fetch or cache entry fills them in.

`data/badge_cards.json` (258 games, 905 KB) has exactly the persisted-cache entry shape: `{ size, cards: [{ hash, title, iconUrl }] }`. Its set sizes agree with `card_counts.json` on all 258 overlapping games; 1,626 games exist only in the counts file. See proposal.md — Why for why this is a second layer, not a replacement.

## Goals / Non-Goals

**Goals:**

- Zero Steam badge-detail requests on the first run for games covered by the bundled badge-cards dataset, including correct titles and icon artwork rendered from bundled data alone.
- One normalizer that accepts both the counts-only array export, the counts record shape, and the badge-cards record shape, so the bundled dataset and the browser cache share one code path.
- Keep the existing fallback chain and serial-detail semantics untouched for games the new file does not cover.

**Non-Goals:**

- No change to the localStorage cache format, key, or write path (learning continues to persist into `BadgeCards.v1` unchanged).
- No compression, codebook, or URL-reconstruction scheme for the dataset (icon URL tokens are opaque server data; reconstructing them is not feasible and compression adds runtime complexity).
- No regeneration tooling changes in this repo; the file is maintained upstream (steam-cards-bot) like `card_counts.json`.

## Decisions

### D1: Bundle as a second JSON import, rich layer wins

`src/ASF-STM.ts` adds `import badgeCardsJson from "../data/badge_cards.json"` next to the existing counts import; both are normalized once per scan run (where `cardDataset` is built today). A new `badgeCardsDataset: BadgeDataset`-shaped structure holds the rich entries. Per-game lookup checks the rich layer first, then the counts layer, then the browser cache, then the remote DB — one extra link at the head of the existing chain.

*Why not replace `card_counts.json`?* The rich file covers 258/1,884 games; replacement would drop set sizes for 1,626 games and *increase* first-run network traffic (see proposal assumption).

*Why not merge both files into one JSON at build time?* It would blur the maintenance boundary (the two files come from different upstream exports/tables) and re-couple their release cadence. Two imports keep each file independently regenerable; the merge is three `??` fallbacks, not a build step.

### D2: Extend `normalizeDataset` to accept card objects

`BadgeDatasetEntry.cards` widens from `string[]` to `Array<{ hash: string; title?: string; iconUrl?: string }>` (same element shape as `BadgeCardCacheEntry.cards`, so `resolveBadgeEntry` can pass cache and dataset entries through one path). The normalizer keeps accepting:
- the counts-only array (`[{ app_id, card_count }]`) → `{ size }`;
- the counts record (`{ appId: { size, name?, cards?: string[] } }`) → string hashes wrapped as `{ hash }`;
- the badge-cards record (`{ appId: { size, cards?: [{ hash, title?, iconUrl? }] } }`) → objects passed through after validating `hash` (non-empty string) and dropping unusable entries, mirroring `readBadgeCardCache`'s tolerance.

An entry whose `cards` array is present but entirely invalid keeps its `size` and loses only the card list — matching how a corrupt cache entry is handled today.

### D3: Rich entries carry titles/icons into derived badges

- `resolveBadgeCardList` returns the rich entry's card objects verbatim (hash + title + iconUrl) instead of mapping to `{ hash }`.
- `resolveBadgeTitle` checks the rich layer's cards only for the *badge* title via the counts/remote path as today — the rich file has no badge-level display name, so a rich-covered game without a counts `name` keeps the `AppID <id>` fallback. Card-level titles come from the card objects; badge-level naming stays a counts-dataset concern.
- `resolvedBadgeCardData` folds the rich layer in before the counts layer so eligibility sees the merged view; entries that differ only by source collapse to the richest one.

### D4: No storage or request changes

`readBadgeCardCache` / `writeBadgeCardCacheEntry` and the `StorageLike` key inventory are untouched: the user-visible localStorage acceleration already exists; this change only widens what is bundled. `requests.ts` and the serial-detail machinery in `src/ASF-STM.ts` are untouched; `needsDatabase` simply becomes false more often because `resolveBadgeSize` now resolves from the rich layer too.

### D5: Build and CI stay as-is

Rolldown already inlines JSON imports; no `rolldown.config.ts` change. The 905 KB file enters the bundle as compacted JS (whitespace only), so the distributable grows by roughly the token size of the data itself (~0.9 MB). CI's existing checks (single file, no `{{PLACEHOLDER}}`, no `// DEBUG` markers) are unaffected.

## Risks / Trade-offs

- [Bundle size grows ~0.9 MB; icon URLs dominate] → Accepted and recorded in the proposal; the alternative (stripping `iconUrl`) restores blank artwork on first run, defeating the purpose. If size ever matters, the regeneration step can drop `iconUrl` upstream without code changes (the normalizer tolerates missing fields).
- [Stale dataset: a game's set composition changes or a hash drifts] → Hashes are exact `market_hash_name` strings; a drift shows up as a game whose derived badge disagrees with the inventory (zero owned matches). Same exposure as the existing counts-dataset hashes; recovery is regenerating the file, not code. The browser cache deliberately does not override the bundle, so a fixed upstream file wins on update.
- [Two bundled sources can disagree on `size`] → Verified today (258/258 agree). Precedence makes the disagreement harmless; a future normalizer could warn in the debug build, noted as optional.
- [`cardList.length !== size` guard rejects a bad entry] → Existing `buildBadgeFromCardList` guard already demotes such a game to the serial detail fetch, so a malformed bundled entry degrades to today's behavior instead of failing the scan.

## Migration Plan

1. Commit `data/badge_cards.json`, extend `dataset.ts`, wire the second import in `src/ASF-STM.ts`, add fixtures, bump version, sync docs.
2. Build and ship as a normal patch release; no storage migration (cache format and key unchanged), no settings changes.
3. Rollback = revert the commit; the previous bundle behavior returns because the new layer is purely additive lookups.
