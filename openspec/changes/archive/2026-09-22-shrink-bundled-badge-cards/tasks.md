# Tasks

## 1. Encoder + decoder

- [x] 1.1 Add compact encoder (long-keys JSON → dense tuple arrays with hash-prefix elision, title fallback, icon-tail stripping) plus `normalizeDataset` decode branch, verified by new round-trip unit tests on rich/size-only/foil fixtures showing byte-for-byte field equality.
- [x] 1.2 Verify legacy shapes still decode by running the existing dataset/normalize tests (`pnpm test`) with no regressions.

## 2. Build integration

- [x] 2.1 Add rolldown plugin intercepting `data/badge_cards.json` to inline the compact encoding and log raw vs compact bytes, verified by `pnpm build` emitting the compact payload and `pnpm typecheck` passing.
- [x] 2.2 Enforce publish budgets (compacted-bytes + built-file) as build failures with byte counts, verified by building with a lowered budget and observing the non-zero exit and message.

## 3. Verification + docs

- [x] 3.1 Measure and record real savings (`dist/ASF-STM.user.js` before/after, compacted vs raw bytes) and add a size-assertion test + CI budget check, verified by `pnpm test` and the CI size step passing.
- [x] 3.2 Docs-sync AGENTS.md/README (source-vs-publish format, budgets), bump `package.json` patch version, and verify `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build` all pass.
