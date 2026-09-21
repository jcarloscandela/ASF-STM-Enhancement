# Proposal

## Why

The project still runs on a legacy toolchain (a Python build script, untyped JavaScript, `node:test` without a runner, an unused prettier config) while carrying `6.x` versioning from a fork whose GitHub repository has been deleted. A modern TypeScript-based toolchain plus a fresh `1.0.0` home gives contributors type safety, standard lint/format/test tooling, and a publishable release flow.

## What Changes

- **BREAKING**: Delete `script/build.py`; the build becomes a Node/TypeScript script run via `pnpm build` producing the same two `dist/` files with the same guarantees (release strips debug lines, missing template/placeholder fails loudly).
- **BREAKING**: Replace `node --test` with `vitest` (`pnpm test`), and replace `.prettierrc` with `oxlint` + `oxfmt` (`pnpm lint`, `pnpm format`); CI runs typecheck, lint, tests, and build.
- Convert `src/lib/*.js` (and their tests) to strict TypeScript first (incremental scope, user-confirmed); the `src/ASF-STM.js` userscript stays JavaScript in this change and consumes the compiled lib output, with full userscript conversion explicitly deferred.
- Reset the version to `1.0.0`.
- Create a new public GitHub repository named `ASF-STM-Enhancement` (assumed under the `jcarloscandela` account), repoint remotes, and push; publish the `1.0.0` release with both `dist/` assets from CI-built output.
- Rewrite `README.md`: current features, development docs for the new toolchain, and an origin note (began as a fork of `iBreakEverything/ASF-STM-Enhancement`, diverged substantially).

## Capabilities

### New Capabilities

- `userscript-release`: how versions are sourced and how CI turns a version bump into a published GitHub release with both distributables.

### Modified Capabilities

- `userscript-build`: same output guarantees, but the build, test, lint, and format commands move to the pnpm/TypeScript/vitest/oxlint toolchain and Python is gone.

## Impact

- Deleted: `script/build.py`, `.prettierrc`. Added: `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `vitest`/`oxlint` configs, TS sources, rewritten workflow, rewritten README.
- No runtime behavior change to the generated userscripts (output must stay functionally identical modulo the version string); `dist/` remains gitignored and CI-built.
- One-shot external actions (create repo, push, publish release) happen in the apply phase; remotes and release URLs change permanently.
