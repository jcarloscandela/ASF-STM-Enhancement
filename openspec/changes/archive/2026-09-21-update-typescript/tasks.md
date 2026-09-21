# Tasks

## 1. Step A — TypeScript 5.9.3 → latest stable 6.0.x

- [x] 1.1 Read the TypeScript 6.0 release/deprecation notes and list the items affecting this repo's tsconfig (`strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `moduleResolution: "bundler"`, `skipLibCheck`, `target/lib ES2022+DOM`) and source; verify the list is written down (empty is valid)
- [x] 1.2 Bump `typescript` to the latest stable 6.0.x in `package.json` and refresh `pnpm-lock.yaml` (`pnpm install`); verify `pnpm list typescript --depth 0` and `pnpm exec tsc --version` report the 6.0.x version
- [x] 1.3 Run `pnpm typecheck` and verify it passes; fix any new type errors or deprecation warnings minimally at the source (no strictness loosening, no behavior changes), keeping exported type contracts intact
- [x] 1.4 Adjust `tsconfig.json` only for options 6.0 removed/renamed/repurposed, and verify `pnpm typecheck` passes with the final config
- [x] 1.5 Run the full gate set (`pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm build`) and verify all pass, confirming rolldown/oxc-node/oxlint are unaffected by the new compiler
- [x] 1.6 Bump the package version (patch) in `package.json` per the versioning rule and commit step A; verify the commit contains package.json, pnpm-lock.yaml, tsconfig/source fixes, and the working tree is clean

## 2. Step B — TypeScript 6.0.x → 7.0.2 (native compiler)

- [x] 2.1 Read the TypeScript 7.0 migration/compatibility notes and check them against the post-step-A tsconfig and gate; verify the applicable-items list is written down
- [x] 2.2 Bump `typescript` to `7.0.2` and refresh the lockfile; verify `pnpm exec tsc --version` reports 7.0.2 and runs on this Windows machine
- [x] 2.3 Run `pnpm typecheck` and verify it passes with the native compiler; compare diagnostics/results against the 6.0.x state and resolve differences at the source, not the config; if a blocking incompatibility appears, stop and surface it to the user instead of pinning back silently
- [x] 2.4 Run the full gate set (`pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm build`) and verify all pass
- [x] 2.5 Bump the package version (patch) in `package.json` and commit step B; verify `git log` shows both upgrade commits and the working tree is clean
- [x] 2.6 Check AGENTS.md/README for statements that drifted (working commands, prerequisites, runner/compiler notes) and update only what changed, or record "no doc impact"; verify docs still match the actual commands
