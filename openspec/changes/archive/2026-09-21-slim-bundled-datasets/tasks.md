# Tasks

## 1. Compact encoding

- [x] 1.1 Extend `normalizeDataset` in `src/lib/dataset.ts` to accept short compact keys and prefix-stripped icon paths (re-attaching the shared constant) while still accepting the current long-key shape, and verify `pnpm typecheck` passes
- [x] 1.2 Add a round-trip fixture test proving compact decode equals current decode for representative games (rich entry, size-only entry, stripped icon URL) and verify `pnpm test` passes

## 2. Data regeneration

- [x] 2.1 Regenerate `data/badge_cards.json` in the compact encoding with counts-only games folded in as size-only entries (export asserts the icon prefix across all icons and fails on mismatch), delete `data/card_counts.json`, and verify the file is smaller and every game from both old files is present
- [x] 2.2 Switch `src/ASF-STM.ts` to the single dataset import (drop `cardDataset`/`badgeCardsDataset` duality where redundant) and verify `pnpm typecheck` and `pnpm test` pass on the full suite

## 3. Docs and release

- [x] 3.1 Update the dataset sections of `AGENTS.md` and `README.md` (one file, compact encoding, exact regeneration commands) and verify the docs match the new layout
- [x] 3.2 Bump the `package.json` patch version and verify `pnpm lint` and `pnpm format:check` pass
- [x] 3.3 Rebuild via `pnpm build` and verify `dist/ASF-STM.user.js` is smaller, carries the new version, and contains no `{{PLACEHOLDER}}` tokens or `// DEBUG` markers
