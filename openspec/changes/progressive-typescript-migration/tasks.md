# Tasks

## 1. Foundation and validation dependency

- [x] 1.1 Add `zod` dependency to `package.json` and verify `pnpm install --frozen-lockfile` succeeds with no audit-critical issues
- [x] 1.2 Import Zod in a scratch lib, run `pnpm build`, and verify the single `dist/ASF-STM.user.js` builds with the dependency bundled and `pnpm typecheck` passes, then remove the scratch lib
- [x] 1.3 Record the chosen bundling approach and `dist/` size delta in `design.md` and verify the decision note is present

## 2. Steam payload schema lib (`steam-payload-schema` spec)

- [x] 2.1 Create `src/lib/steam-schema.ts` with inventory description/asset schemas and inferred types and verify `pnpm typecheck` passes
- [x] 2.2 Add badge `rgCards` and bot-list entry schemas with safe fallbacks and verify `pnpm typecheck` passes
- [x] 2.3 Add `test/steam-schema.test.ts` fixtures (valid, malformed, unknown-field, flag-variant, future-hold cases) and verify `pnpm test` passes
- [x] 2.4 Import `src/lib/steam-schema.ts` from `src/ASF-STM.ts` via a normal module import and verify `pnpm build` emits `dist/ASF-STM.user.js` with the lib bundled and `pnpm typecheck` passes

## 3. Scanner config lib (`scanner-config` spec)

- [x] 3.1 Extend `src/lib/settings.ts` in place with typed defaults schema and per-key fallback merge and verify `pnpm typecheck` passes
- [x] 3.2 Add `test/scanner-config.test.ts` fixtures (stored-true survives, new-key backfill, corrupt storage, wrong-typed value, scan-plan precedence) and verify `pnpm test` passes
- [x] 3.3 Swap `LoadConfig`/`resolveScanPlan` call sites in `src/ASF-STM.ts` to thin wrappers over the lib and verify existing `test/settings.test.ts` plus new tests pass via `pnpm test`

## 4. Matcher core lib (`matcher-core` spec)

- [x] 4.1 Extract pure matching (`calcBadgeState`, match search, match-store building) from `src/ASF-STM.ts` into `src/lib/matcher-core.ts` with no DOM/XHR/GM imports and no logic changes, and verify `pnpm typecheck` and `pnpm lint` pass
- [x] 4.2 Add `test/matcher-core.test.ts` fixtures (even badge = no trade, uneven = evening trade, ANY vs fair-bot fairness, per-game balance, determinism) and verify `pnpm test` passes
- [x] 4.3 Add golden-equivalence test against current `src/ASF-STM.ts` behavior on 2–3 representative badges and verify `pnpm test` passes before swapping call sites
- [x] 4.4 Swap `calcState`/`compareCards`/`storeMatches` call sites to thin wrappers and verify `pnpm test` and `pnpm build` both pass

## 5. Final verification, docs, and release hygiene (`userscript-build` spec)

- [x] 5.1 Run full verification (`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`) and verify `dist/ASF-STM.user.js` exists with version string and no `{{PLACEHOLDER}}` tokens
- [x] 5.2 Sync docs (`AGENTS.md`/`README.md` lib list and commands) and bump `package.json` patch version and verify `pnpm format:check` passes
