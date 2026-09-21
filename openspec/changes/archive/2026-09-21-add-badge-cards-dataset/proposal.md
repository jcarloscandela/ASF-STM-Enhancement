# Proposal

## Why

On a first run (empty browser cache) the inventory scan still hits Steam for every candidate game whose card list is not bundled: `data/card_counts.json` carries per-card market hashes for only a fraction of its 1,884 games, so most covered games degrade to serial `ajaxgetbadgeinfo` requests or the lazily fetched remote badges database. The user exported a richer dataset (`data/badge_cards.json`: 258 popular games, each with its full card list — exact `market_hash_name`, display title, and icon URL — 905 KB). Bundling it removes effectively all badge-detail traffic for those games on the very first execution, and titles/icons render immediately instead of after a per-game fetch.

**Recorded assumption**: the request said "instead of card_counts", but the exported file covers only 258 of the 1,884 bundled games (sizes agree where they overlap; 1,626 games exist only in `card_counts.json`). Replacing the counts dataset outright would *lose* size coverage for 1,626 games and force more network calls — the opposite of the stated goal. This change therefore bundles `badge_cards.json` **alongside** `card_counts.json` as the higher-priority layer; games absent from it keep the existing fallback chain (counts dataset → browser cache → lazy remote DB → serial detail fetch).

## What Changes

- Bundle `data/badge_cards.json` into the userscript at build time (rolldown JSON import, same mechanism as `card_counts.json`), as a second bundled dataset layer.
- Extend dataset normalization to accept the badge-cards record shape: `appId -> { size, cards: [{ hash, title, iconUrl }] }` — the exact shape already used by the browser-persisted cache, so the same parser handles both sources.
- Resolution precedence per game becomes: **bundled badge-cards dataset (rich: hashes + titles + icons) → bundled counts dataset (sizes, optional name/hashes) → browser-persisted cache → lazy remote badges database → serial badge-detail fetch**. The rich layer wins for the 258 games it covers; everything else is unchanged.
- Badge slots derived for rich-layer games carry real display titles and icon URLs on the first run (today a dataset-derived slot can only produce `{ hash }`, leaving icons blank until a detail fetch or cache entry exists).
- First-run scan for a rich-layer-covered game issues zero Steam badge-detail requests and (when only rich-layer games are candidates) can skip even the remote badges-database fetch.
- Games not present in `badge_cards.json` behave exactly as today, and anything learned at runtime still persists to localStorage (`TempAsfStm.ASF.STM.BadgeCards.v1`) for faster later scans — the localStorage part of the request is existing behavior being preserved, not new work.
- Accepted trade-off: the single-file bundle grows by roughly the size of the inlined dataset (~0.9 MB raw; icon URLs dominate). Recorded as intentional — the icons are what make detail-free first-run rendering possible.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `trade-matching`: the "Inventory-mode scan derives badges from inventory only" requirement changes — the bundled inputs now include the rich badge-cards dataset layer, which takes precedence over the counts-only dataset and supplies per-card titles and icon URLs, so covered games derive complete badge slots locally on the first run with no badge-detail request; the fallback order for uncovered games is restated unchanged.

## Impact

- `data/badge_cards.json` — new committed dataset (already present in `data/`, untracked); regeneration stays with the steam-cards-bot workflow like `card_counts.json`.
- `src/lib/dataset.ts` — normalization extended for the rich record shape; `resolveBadgeEntry` preserves bundled titles/icon URLs instead of mapping every dataset card to `{ hash }`.
- `src/ASF-STM.ts` — load/normalize the second JSON import; `resolveBadgeSize` / `resolveBadgeTitle` / `resolveBadgeCardList` / `resolvedBadgeCardData` consult the rich layer first.
- `rolldown.config.ts` — no change required (JSON imports are already inlined); CI placeholder/debug checks unaffected.
- `test/` — fixtures for the rich-shape normalization, precedence (rich > counts > cache), and title/icon propagation into derived badges.
- Docs: `AGENTS.md` / `README.md` dataset layout and precedence; `package.json` version bump per repo rules.
