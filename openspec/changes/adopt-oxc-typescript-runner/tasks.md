# Tasks

## 1. Baseline and spike

- [x] 1.1 Record baseline `tsx` build outputs and test results, verified by `pnpm test`, `pnpm build`, and checksums of `dist/ASF-STM.user.js` and `dist/ASF-STM.debug.js` saved outside `dist/`
- [x] 1.2 Install pinned `@oxc-node/cli` and/or `@oxc-node/core` alongside `tsx` and add side-by-side `build:oxc` script, verified by `pnpm install --frozen-lockfile` succeeding and `oxnode --help` (or `node --import @oxc-node/core/register`) executing
- [x] 1.3 Run the Oxc build path and diff against the baseline, verified by byte-identical `dist/` outputs (excluding version) or a logged divergence report

## 2. Cutover

- [x] 2.1 Flip `package.json` `build` and `test` scripts to the Oxc runner while keeping command names stable, verified by `pnpm build` regenerating both distributables with no unreplaced `{{PLACEHOLDER}}` tokens
- [x] 2.2 Verify unit tests pass under the Oxc pipeline with the same include pattern, verified by `pnpm test` passing and exiting non-zero on an injected failure
- [x] 2.3 Verify `tsc --noEmit` still gates types separately from execution, verified by `pnpm typecheck` failing on an injected type error while the Oxc runner still executes
- [x] 2.4 Verify watch mode and source-mapped stack traces, verified by `oxnode --watch` (or hook equivalent) re-executing on edit and a forced build failure pointing at the `.ts` file and line

## 3. Cleanup and docs

- [x] 3.1 Remove `tsx` fallback after parity is proven and refresh the lockfile, verified by clean `pnpm install --frozen-lockfile` plus full `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` passing with no `tsx` resolution
- [x] 3.2 Update CI workflow and contributor docs (minimum Node version, experimental-runner note, pin/rollback procedure), verified by `build.yml` executing tests and build via the Oxc path and README describing the new commands
- [ ] 3.3 Run final validation across Windows and CI Linux, verified by `openspec validate --change adopt-oxc-typescript-runner --strict` passing and both `dist/` files containing the current version string with debug lines stripped only in release
