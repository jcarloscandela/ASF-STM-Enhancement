# Tasks

## 1. Step A — vitest 3.2.7 → latest stable 4.x

- [x] 1.1 Read the vitest v4 breaking-changes/upgrade guide and check the entries against `vitest.config.ts` and the `test` script; verify a short list of applicable items exists (empty list is a valid outcome)
- [x] 1.2 Bump `vitest` to the latest stable 4.x in `package.json` and refresh `pnpm-lock.yaml` (`pnpm install`); verify `pnpm list vitest --depth 0` reports the 4.x version
- [x] 1.3 Run `pnpm test` and verify all 9 test files execute and pass; if the entry path `./node_modules/vitest/vitest.mjs` moved, re-point the `test` script while keeping the `@oxc-node/core/register` hook, and verify `pnpm test` still passes
- [x] 1.4 Fix any config renames/removals in `vitest.config.ts` needed to run the suite unchanged (`include` semantics identical); verify `pnpm test` passes with the final config
- [x] 1.5 Run the full gate set (`pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build`) and verify all pass
- [x] 1.6 Bump the package version (patch) in `package.json` per the versioning rule and commit step A; verify the commit contains package.json, pnpm-lock.yaml, and any config/script changes

## 2. Step B — vitest 4.x → 5.0.1

- [x] 2.1 Read the vitest v5 breaking-changes/upgrade guide and check the entries against the current config/script; verify a short list of applicable items exists
- [x] 2.2 Bump `vitest` to `^5.0.1` and refresh the lockfile; verify `pnpm list vitest --depth 0` reports `5.0.1` or newer in-range
- [x] 2.3 Run `pnpm test` and verify all tests execute and pass through the Oxc hook path; apply the same config/script adjustments policy as step A if needed
- [x] 2.4 Run the full gate set (`pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build`) and verify all pass
- [x] 2.5 Bump the package version (patch) in `package.json` and commit step B; verify `git log` shows both upgrade commits and the working tree is clean
- [x] 2.6 Check README/AGENTS.md for statements about the test runner that changed (e.g., launch mechanics); update only what drifted, or record "no doc impact"; verify docs still describe `pnpm test` accurately
