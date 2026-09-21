# Tasks

## 1. Dataset module (`src/lib/dataset.ts`)

- [x] 1.1 Widen `BadgeDatasetEntry.cards` to `Array<{ hash: string; title?: string; iconUrl?: string }>` and update `resolveBadgeEntry` so bundled entries pass card objects through (no more `{ hash }`-only mapping); verify `pnpm typecheck` reports exactly the expected call-site breaks
- [x] 1.2 Extend `normalizeDataset` to accept the badge-cards record shape (`{ appId: { size, cards: [{ hash, title?, iconUrl? }] } }`): validate `hash` as a non-empty string, pass optional `title`/`iconUrl` through, drop unusable card entries, keep an entry whose cards are all invalid as size-only; verify with `pnpm test` after 2.1
- [x] 1.3 Keep the existing counts-only array form and counts record form (`cards: string[]`) normalizing exactly as before, wrapping hashes as `{ hash }`; verify no existing fixture in `test/` changes meaning

## 2. Scanner wiring (`src/ASF-STM.ts`)

- [x] 2.1 Add `import badgeCardsJson from "../data/badge_cards.json"`, normalize it alongside `cardCountsJson` where the scan run builds `cardDataset`, and hold it in a second module-scope dataset; verify `pnpm build` succeeds and the bundle contains a distinctive bundled hash string (e.g. `220-Alyx Vance`)
- [x] 2.2 Update `resolveBadgeSize` / `resolveBadgeTitle` / `resolveBadgeCardList` / `resolvedBadgeCardData` to consult the rich layer before the counts layer and the browser cache, returning rich card objects verbatim (hash + title + iconUrl); verify by code reading that the fallback order matches design D1/D3
- [x] 2.3 Confirm first-run behavior paths: `needsDatabase` becomes false when all candidate sizes resolve from either bundled layer, and rich-covered games never enter the serial `ajaxgetbadgeinfo` pending list; verify with a debug-build scan against an empty cache (no `ajaxgetbadgeinfo` requests for covered games, cards render with artwork)

## 3. Tests (`test/`)

- [x] 3.1 Add dataset fixtures + cases for the badge-cards record shape: valid entries, missing `title`/`iconUrl`, invalid/empty `hash` dropped, all-invalid cards leaves size-only entry; verify `pnpm test` passes
- [x] 3.2 Add precedence cases: rich layer wins over counts entry for the same appId; counts-only game still resolves size; cache never overrides either bundled layer; verify `pnpm test` passes
- [x] 3.3 Add a `buildBadgeFromCardList`/resolution case asserting derived slots carry bundled `title` and `iconUrl` on a cache-less first run; verify `pnpm test` passes

## 4. Data, docs, release hygiene

- [x] 4.1 Commit `data/badge_cards.json` (verify it is tracked and parses; sizes agree with `card_counts.json` on overlap) and reference its upstream regeneration path in the docs like `card_counts.json`
- [x] 4.2 Update `AGENTS.md` and `README.md`: two bundled datasets, the rich-layer precedence, and the first-run no-detail-fetch behavior for covered games (docs-sync rule)
- [x] 4.3 Bump `package.json` version (patch minimum) and verify `pnpm build` emits the new version in the userscript header
- [x] 4.4 Run the full gate: `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm build`, and confirm `dist/` stays gitignored with a single self-contained file
