# Tasks

## 1. Build pipeline swap

- [x] 1.1 Add the chosen bundler (rolldown preferred, esbuild fallback) as a devDependency and verify `pnpm install --frozen-lockfile` succeeds
- [x] 1.2 Configure bundling (TS entry, raw template-text imports, version define from `package.json`, userscript metadata banner) and verify a smoke entry compiles to a single file
- [x] 1.3 Point `pnpm build` at the bundler, delete `scripts/build.ts`, and verify `pnpm build` emits only `dist/ASF-STM.user.js` with the current version in its header and no `{{PLACEHOLDER}}` tokens

## 2. Userscript conversion

- [x] 2.1 Convert templates to imports (CSS + 4 JS/HTML fragments as text modules) and verify no template placeholder references remain in the source
- [x] 2.2 Convert `src/ASF-STM.js` to TypeScript verbatim-first (normal imports for `src/lib/*`, ambient declarations for Tampermonkey globals, IIFE wrapper kept) and verify `pnpm typecheck` passes with strict mode unchanged
- [x] 2.3 Retire the `// DEBUG` convention (keep `debugPrint`/timers gated on the existing debug setting) and verify no `// DEBUG` markers remain in source or `dist/`
- [x] 2.4 Diff the new single-file output against the reference old-pipeline build and verify scanning/matching behavior is identical apart from the intended single-file change

## 3. Cutover, docs, and release hygiene

- [x] 3.1 Update CI (build, verify, and draft-release steps) to the single `dist/ASF-STM.user.js` artifact and verify the workflow definition references no debug file, placeholder check, or builder script
- [x] 3.2 Update `README.md` and `AGENTS.md` (single install asset, TS source layout, debug-setting usage, reinstall note for debug-file users, new `pnpm build`) and bump the `package.json` patch version, and verify every command and link works from a clean checkout
- [x] 3.3 Run full verification (`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm format:check`) and verify all green with `dist/` gitignored, then run `openspec validate --change single-typescript-userscript --strict` and verify it passes
