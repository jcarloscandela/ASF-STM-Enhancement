# Tasks

## 1. Full-archive merge logic

- [x] 1.1 Add pure full-archive merge helper next to `diffNewBadgeCardEntries` in `src/lib/dataset.ts` (bundled verbatim + diff overlay, bundled-rich-wins, numeric key order) and verify with new unit cases in `test/dataset.test.ts` via `pnpm test -- test/dataset.test.ts`
- [x] 1.2 Switch `triggerDatasetExport` in `src/lib/dataset-export.ts` to keep gating on the diff count but serialize and download the merged archive via the existing authoring serializer, and verify the empty-diff path still downloads nothing via `pnpm test -- test/dataset-export.test.ts`

## 2. Export behavior coverage

- [x] 2.1 Extend `test/dataset-export.test.ts` happy-dom harness to assert the download contains bundled + new games, size-only upgrade, bundled-rich-wins, and sorted keys, and verify via `pnpm test -- test/dataset-export.test.ts`
- [x] 2.2 Add a round-trip case proving the downloaded archive parses as valid JSON and loads back through `normalizeDataset` with identical sizes, hashes, titles, and full icon URLs, and verify via `pnpm test`

## 3. Docs and release hygiene

- [x] 3.1 Update `AGENTS.md` and `README.md` Dataset-tab wording from diff-only to full merged archive and bump the patch version in `package.json`, and verify with `git diff -- AGENTS.md README.md package.json`
- [x] 3.2 Run the full repo gate (`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`) and verify all four pass with no `dist/` file committed
