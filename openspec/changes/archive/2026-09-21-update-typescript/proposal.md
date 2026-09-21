# Proposal

## Why

`typescript` is pinned at `5.9.3` while `7.0.2` is current; the project sits on the last classic-tsc line before the native (Go-based) compiler line (6.x transitional, 7.x native). The compiler is the project's type gate (`pnpm typecheck` = `tsc --noEmit`, strict mode) and the trust anchor for the exported Steam payload type contracts, so staying current matters most here — but it is also the riskiest of the three outdated dependencies, which is why it runs last in the progressive refresh, after `update-oxfmt` and `update-vitest` have landed.

## What Changes

- Upgrade `typescript` from `5.9.3` to `7.0.2` in two separately-committed steps:
  - Step A: `5.9.3` → latest stable `6.0.x` (the transitional major); resolve any new type errors, deprecation warnings, or tsconfig fallout.
  - Step B: `6.0.x` → `7.0.2` (the native compiler major); verify the `tsc --noEmit` gate still works identically and resolve any remaining differences.
- Keep strict-mode settings intact (`strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `skipLibCheck`); adjust `tsconfig.json` only where a new major removes, renames, or repurposes an option.
- Verify the surrounding toolchain against the new compiler: `rolldown` build, `@oxc-node` runner, `oxlint`, and `@types/node` — none of them bundle via the `typescript` package (rolldown and oxc-node use their own oxc transforms), so no version coupling is expected, but all gates must stay green.
- Bump the package version (patch) per the versioning rule.

No runtime or bundle changes expected: `typescript` is dev-only and the bundler transform is independent; the distributable should be byte-identical apart from sources changed solely to satisfy new type checks.

## Capabilities

### New Capabilities

(none — pure dev-tooling update; the change declares `skip_specs: true`)

### Modified Capabilities

(none — the `typescript-runner` capability is version-agnostic ("strip types without type-checking so that `tsc --noEmit` remains the separate type gate") and remains satisfied; `userscript-build`'s "typechecking passes with no errors" scenario likewise)

## Impact

- `package.json` / `pnpm-lock.yaml`: `typescript` `5.9.3` → `6.0.x` → `7.0.2`, version patch bump (per committed step).
- `tsconfig.json`: option adjustments only if the new majors require them.
- `src/**/*.ts`, `test/**/*.ts`, `scripts/**/*.ts`: source edits only where TS 6/7 type checking surfaces new errors or deprecations; no behavior changes intended.
- `pnpm typecheck` behavior/performance: TS 7 is the native compiler — expect faster runs; watch for diagnostic-format changes that could affect humans, not tooling (nothing parses tsc output in scripts or CI).
- Order dependency: apply after `update-oxfmt` and `update-vitest`; landing it last means any source edits needed for the new compiler are made against an already-current toolchain and canonical formatting.
