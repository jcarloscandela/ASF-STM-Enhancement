# Proposal

## Why

The parallel badge-detail crawl shipped in 1.0.12 (6 concurrent `ajaxgetbadgeinfo` requests) speeds the scan up but issues parallel requests to Steam, which risks account restriction. The user maintains a card dataset (`data/card_counts.json`, exported from the steam-cards-bot project's `card_counts` table: 1,884 games with set sizes) that can remove most badge-detail loading altogether. Additionally, badge card data is per-game STATIC information (a set's composition never changes), so once the scanner learns a game's card list it should persist it in the browser and never fetch that game again - today every scan re-fetches known games.

## What Changes

- Bundle the card dataset into the userscript at build time (rolldown inlines `data/card_counts.json`; no runtime fetch for bundled data).
- Define a two-level dataset schema: every game has a set size (`size`), optionally a display name (`name`), and optionally the full card list (`cards`: exact `market_hash_name` per card).
- **For games with a card list** (bundled or learned): badge card slots are derived locally (hashes from the card list, owned/tradable counts from the inventory fetch) - zero badge-detail requests for these games.
- **Learned card data persists in the browser**: a game's card list learned from a badge-detail fetch is stored in localStorage and reused by every later scan; only games with no bundled AND no cached data trigger a badge-detail request.
- **For games with sizes only or not covered**: the badge-detail API is used exactly as before the parallel experiment - **serially, one request at a time, paced by the web limiter**. The parallel crawl (6 in flight) is removed.
- Set-size fallback chain: bundled dataset -> browser cache -> remote badges database (fetched lazily, only when a candidate game is missing from both, and its sizes are then cached too).
- Covered games whose display name is not known show their appId as the badge title until a name is added to the dataset (recorded trade-off; the schema supports adding names).
- **Answers the user's questions directly**: (1) yes - the file's set sizes are usable immediately and the remote badges database becomes a lazy fallback; (2) yes - to prevent badge loading for a game the dataset must include each card's exact `market_hash_name`; counts alone only replace the size lookup; (3) yes - the JSON is packed into `ASF-STM.user.js` at build time; (4) localStorage caching also covers every other static-per-game datum (sizes, titles), while per-scan data (inventory counts, bot lists) stays fresh by design.
- steam-cards-bot is the maintenance path for the dataset (its `card_counts` table is the source; its inventory cache is the natural source for per-card hashes). No code is imported from it (different runtime); only the exported JSON flows between the projects.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `trade-matching`: the inventory-mode derivation requirement changes - badge-detail requests are no longer forbidden outright but are limited to games with no bundled or cached card data, and only serially (never parallel); the bounded-concurrency requirement added by the previous change is removed (parallel requests risk account restriction) and replaced by the bundled-dataset fast path, the browser-persisted card cache, and the serial fallback.

## Impact

- `data/card_counts.json` - committed dataset; schema extended from counts-only to the two-level shape (sizes now, card lists as the user generates them).
- `src/lib/tradable.ts` or a new `src/lib/dataset.ts` - dataset access, normalization (accepts the current counts-only export and the richer shape), badge-slot derivation from dataset/cached card lists + inventory counts, and the localStorage card cache.
- `src/lib/storage.ts` - one new storage key for the learned-card cache.
- `src/ASF-STM.ts` - `getBadgesInventory` consults the bundle and cache first and fetches the remote badges database lazily; `GetOwnCards` drops the parallel machinery and returns to the serial, paced crawl for uncovered games only; `processFilters` unchanged apart from the data source.
- `rolldown.config.ts` - inline the dataset at build time.
- `test/` - dataset normalization, covered/learned-game derivation, serial-fallback, and cache round-trip fixtures.
- Docs: `README.md` / `AGENTS.md` dataset schema, the regeneration workflow from steam-cards-bot, and the browser cache; version bump per repo rules.
