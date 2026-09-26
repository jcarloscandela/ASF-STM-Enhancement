# Proposal

## Why

Five dev dependencies lag their latest releases (`pnpm outdated`, 2026-09-26). All are patch/minor bumps with no breaking changes, and all are dev-only, so the userscript runtime is unaffected — staying current keeps the security and tooling baseline from rotting.

## What Changes

- Bump in order, gates after each: `vitest` 5.0.1 → 5.0.2 with `@vitest/coverage-v8` in lockstep, `rolldown` 1.2.9 → 1.2.11 (rebuild, check `dist` size/budgets), `oxlint` 1.83.0 → 1.85.0 (adapt to any newly-warning rules), `oxfmt` 0.68.0 → 0.70.0 (accept any reflow in its own commit step).
- Leave `packageManager` (pnpm 12.3.4) and the Node floor alone: environment-level, not repo dependencies.
- No source, test, config, or spec changes unless a gate forces an adaptation (recorded as a finding, not silent absorption).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None — dev-tooling only, no runtime or spec-level behavior change; `skip_specs: true` is set in `.openspec.yaml`.

## Impact

- Affected files: `package.json`, `pnpm-lock.yaml` only (plus any gate-forced adaptation, recorded separately).
- Zero userscript runtime risk: every bumped package is dev-only.
