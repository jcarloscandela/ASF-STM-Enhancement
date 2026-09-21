# Proposal

## Why

The userscript is still assembled by a bespoke builder (`scripts/build.ts`) that expands `{{PLACEHOLDERS}}`, inlines compiled libs, and emits two near-identical distributables (release + debug). That builder is custom tooling contributors must understand and maintain, and the `src/ASF-STM.js` body it processes is ~2124 lines of untyped JavaScript. A single TypeScript source compiled directly to one distributable removes the builder entirely and brings the whole userscript under typechecking.

## What Changes

- **BREAKING**: Delete `scripts/build.ts`; `pnpm build` becomes a direct TypeScript-to-userscript compilation (e.g. `tsc`/bundler emit) with no placeholder expansion step and no `{{PLACEHOLDER}}` tokens anywhere in the pipeline.
- **BREAKING**: Replace the two distributables (`dist/ASF-STM.user.js` + `dist/ASF-STM.debug.js`) with a single `dist/ASF-STM.user.js`. Debug support moves into the single file (e.g. a runtime debug flag instead of a separate debug-marked variant); the `// DEBUG` line-stripping convention is retired.
- Convert `src/ASF-STM.js` to TypeScript (full conversion, user-confirmed), with `src/lib/*.ts` imported as normal modules instead of inlined through placeholders.
- Convert `src/templates/*` contents into TypeScript imports (template files become modules/assets consumed by the TS source) so no template-expansion step remains.
- Keep the version source as `package.json`, injected into the single userscript header at compile time; the release flow publishes one asset.
- No runtime behavior change to scanning/matching/offer logic (output must stay functionally identical modulo the single-file/debug-flag change); `dist/` remains gitignored and CI-built.

## Capabilities

### New Capabilities

- None. No new user-facing capability is introduced; this is a source/build consolidation with a reduced distributable set.

### Modified Capabilities

- `userscript-build`: the build produces one distributable from a TypeScript source with no builder script, no placeholders, and no debug-line stripping; tests/typecheck/lint/CI guarantees stay.
- `userscript-release`: version sourcing stays on `package.json`, but the release carries the single distributable as its asset and the install URL points at it.

## Impact

- Deleted: `scripts/build.ts`, `src/templates/` placeholder mechanism, `dist/ASF-STM.debug.js`. Added/changed: TypeScript userscript source, compile-based `pnpm build`, single-file `dist/ASF-STM.user.js`.
- `package.json` scripts change (`build` no longer runs a builder script; `test`/`lint`/`format`/`typecheck` unchanged in shape); devDependency changes depend on the chosen compile tool (decided in design).
- CI workflow: `build` + verify steps simplify to one artifact; release step attaches one file.
- `README.md`/`AGENTS.md` need updates (single install asset, TS source layout, debug-flag usage, reinstall note for debug-variant users).
- Risk: the ~2124-line conversion can introduce behavior drift → mitigated by keeping the conversion verbatim-first with fixture/golden tests (detailed in design/tasks).
