# Tasks

## 1. Template coverage

- [x] 1.1 Add `test/templates.test.ts` asserting structure (ids, classes, data attributes) of every template render function, and verify with `pnpm test`.
- [x] 1.2 Add escaping cases for untrusted content (nicknames with markup, game names with entities) across the templates, and verify with `pnpm test`.
- [x] 1.3 Relocate `createScanFilterElement` to an importable home with byte-identical output, cover active/inactive variants, and verify with `pnpm test` plus a before/after output diff showing no change.

## 2. Codec adversarial cases

- [x] 2.1 Add `=`-escape and `\0`-sentinel edge cases (prefix-less hashes, empty titles, icon tails) to the dataset codec tests, and verify with `pnpm test`.

## 3. Regression and release gates

- [x] 3.1 Run the full verification suite (`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`) and verify all gates pass with no `dist/` commit.
- [x] 3.2 Bump the patch version once (coordinate a single bump if sibling health changes land together), sync contributor docs, and verify `openspec validate template-test-coverage --strict` passes.
