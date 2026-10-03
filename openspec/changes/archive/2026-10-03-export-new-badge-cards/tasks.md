# Tasks

## 1. Pure diff and export helpers with fixture tests

- [x] 1.1 Add diff helper (bundled dataset vs badge-cards cache: unbundled appId is new, size-only bundled plus rich cache is new, bundled-rich suppresses, corrupt cache yields none) following `test/dataset.test.ts` fixture style and verify the new unit tests pass
- [x] 1.2 Add authoring-shape serializer (long keys `size`/`name`/`cards` + `hash`/`title`/`iconUrl` with full icon URLs, pretty-printed JSON) and verify a round-trip test through `normalizeDataset` reproduces size, names, hashes, titles, and icon URLs

## 2. Config-dialog Dataset tab and download wiring

- [x] 2.1 Add the "Dataset" tab markup (`src/templates/`) with the disabled-by-default download button, new-entry count text, and manual-merge hint, and verify the template test renders the disabled state
- [x] 2.2 Wire dialog-open and post-learn state refresh plus the Blob-anchor `badge_cards.json` download in `src/ASF-STM.ts` (thin wiring only) and verify with a happy-dom harness test that empty diff keeps the button disabled, a learned uncovered game enables it, and activating the disabled button downloads nothing

## 3. Docs, versioning, and gates

- [x] 3.1 Update `AGENTS.md` with the 20-entry sampling rule for `badge_cards.json`/badge-cards cache reads plus the export-and-merge workflow, and touch `README.md` only if it documents the dataset workflow, verified by reviewing the rendered diff
- [x] 3.2 Bump the `package.json` patch version and run `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build`, verifying all pass and `openspec validate "export-new-badge-cards"` is clean
