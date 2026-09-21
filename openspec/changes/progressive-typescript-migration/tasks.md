# Tasks

## 1. Foundation and validation spike

- [ ] 1.1 Add `zod` dependency to `package.json` and verify `pnpm install --frozen-lockfile` succeeds with no audit-critical issues
- [ ] 1.2 Spike Zod inlining into the single-file bundle (esbuild pre-bundle vs vendored guards) and verify both `dist/` files build with no `{{PLACEHOLDER}}` tokens via `pnpm build`
- [ ] 1.3 Record the chosen inlining approach and `dist/` size delta in `design.md` and verify the decision note is present

## 2. Steam payload schema lib (`steam-payload-schema` spec)

- [ ] 2.1 Create `src/lib/steam-schema.ts` with inventory description/asset schemas and inferred types and verify `pnpm typecheck` passes
- [ ] 2.2 Add badge `rgCards` and bot-list entry schemas with safe fallbacks and verify `pnpm typecheck` passes
- [ ] 2.3 Add `test/steam-schema.test.ts` fixtures (valid, malformed, unknown-field, flag-variant, future-hold cases) and verify `pnpm test` passes
- [ ] 2.4 Wire `{{STEAM_SCHEMA_LIB}}` placeholder through `src/ASF-STM.js` and generic builder discovery and verify `pnpm build` emits both `dist/` files with the lib inlined

## 3. Scanner config lib (`scanner-config` spec)

- [ ] 3.1 Extend `src/lib/settings.ts` (or add `src/lib/scanner-config.ts`) with typed defaults schema and per-key fallback merge and verify `pnpm typecheck` passes
- [ ] 3.2 Add `test/scanner-config.test.ts` fixtures (stored-true survives, new-key backfill, corrupt storage, wrong-typed value, scan-plan precedence) and verify `pnpm test` passes
- [ ] 3.3 Swap `LoadConfig`/`resolveScanPlan` call sites in `src/ASF-STM.js` to thin wrappers over the lib and verify existing `test/settings.test.ts` plus new tests pass via `pnpm test`

## 4. Matcher core lib (`matcher-core` spec)

- [ ] 4.1 Extract pure matching (`calcBadgeState`, match search, match-store building) verbatim into `src/lib/matcher-core.ts` with no DOM/XHR/GM imports and verify `pnpm typecheck` and `pnpm lint` pass
- [ ] 4.2 Add `test/matcher-core.test.ts` fixtures (even badge = no trade, uneven = evening trade, ANY vs fair-bot fairness, per-game balance, determinism) and verify `pnpm test` passes
- [ ] 4.3 Add golden-equivalence test against current `ASF-STM.js` behavior on 2–3 representative badges and verify `pnpm test` passes before swapping call sites
- [ ] 4.4 Swap `calcState`/`compareCards`/`storeMatches` call sites to thin wrappers and verify `pnpm test` and `pnpm build` both pass

## 5. Build pipeline, docs, and release hygiene (`userscript-build` spec)

- [ ] 5.1 Generalize `scripts/build.ts` from the hardcoded lib list to sorted `src/lib/*.ts` discovery with missing-placeholder errors and verify a new dummy lib is picked up by `pnpm build` then removed
- [ ] 5.2 Run full verification (`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`) and verify `dist/` files exist with version string and no `{{PLACEHOLDER}}` tokens
- [ ] 5.3 Sync docs (`AGENTS.md`/`README.md` lib list and commands) and bump `package.json` patch version and verify `pnpm format:check` passes
