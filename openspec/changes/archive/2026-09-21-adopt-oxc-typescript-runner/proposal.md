# Proposal

## Why

The project already standardizes on Oxc for lint (`oxlint`) and format (`oxfmt`), but still runs TypeScript via `tsx` (`pnpm build` → `tsx scripts/build.ts`, vitest transform). Adopting Oxc's TypeScript runner (`oxnode` / `@oxc-node/core`) would consolidate the toolchain on one parser/transformer family, reduce dependencies, and speed up local build/test startup. The runner is explicitly experimental, so this change plans a cautious, reversible, future adoption — not an immediate forced cutover.

## What Changes

- Add `@oxc-node/cli` (for `oxnode` CLI) and/or `@oxc-node/core` (for `node --import @oxc-node/core/register`) as dev dependencies, replacing `tsx` as the TypeScript executor for `scripts/build.ts` and vitest/test invocation.
- Update `package.json` scripts (`build`, `test`, `dev`-style watch) to run through the Oxc runner while keeping the same command names and outputs.
- Verify `scripts/build.ts` output parity: `dist/ASF-STM.user.js` and `dist/ASF-STM.debug.js` remain byte-equivalent (modulo version) to the `tsx` build, including template expansion, lib inlining, placeholder validation, and debug-line stripping.
- Verify test parity: `vitest run` passes unchanged under the Oxc transform path (or documents any config shim required).
- Document the experimental status, fallback to `tsx` (or pinned version), upgrade/rollback procedure, and known limitations (no type-checking, ESM/CJS inference, `tsconfig.json` option coverage).
- Keep `tsc --noEmit` as the type-check gate since the Oxc runner strips types without checking.

## Capabilities

### New Capabilities

- `typescript-runner`: Running TypeScript sources, build script, and tests through the Oxc TypeScript runner with supported extensions, sourcemaps, watch mode, and tsconfig integration.

### Modified Capabilities

- `userscript-build`: Build and test commands keep their existing guarantees (both distributables, single-command tests, CI gate) but execute via the Oxc runner instead of `tsx`; outputs must remain equivalent and CI must enforce the new path.

## Impact

- Affected code: `package.json` scripts + devDependencies, `scripts/build.ts` (possible minor transform-compat tweaks, e.g. `typescript.transpileModule` usage vs Oxc transform), `vitest.config.ts` (if a transform plugin/shim is needed), CI workflow under `.github/`, `README.md` contributor docs.
- Dependencies: adds `@oxc-node/cli` and/or `@oxc-node/core`; removes (or demotes to fallback) `tsx`. No runtime/production dependency change — `dist/` stays single-file userscript.
- Systems: local dev (Windows + CI Linux), `pnpm` workflow, Node.js version compatibility with `node --import` register hooks.
- Risk: runner is experimental — APIs/behavior may change between releases; mitigation is version pinning, output-parity checks, and a documented rollback to `tsx`.
