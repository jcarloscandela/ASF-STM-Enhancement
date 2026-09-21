# Proposal

## Why

`oxfmt` is two years of releases behind: the project pins `0.16.0` while the formatter is now at `0.68.0`. As a 0.x tool, every minor is effectively breaking, so the gap only widens and each future bump gets harder. Updating it now, as the first and lowest-risk step of the dependency-refresh effort, keeps the formatting pipeline current before the riskier `vitest` and `typescript` upgrades land.

## What Changes

- Bump `oxfmt` from `0.16.0` to `0.68.0` (devDependency, `^` range retained).
- Re-run `pnpm format` so all formatted sources (`src`, `scripts`, `test`, `rolldown.config.ts`) adopt the new formatter's canonical output; commit the result as its own step so the diff is purely formatting.
- Verify `pnpm format:check`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build` all pass after the bump; fix any config drift in `.oxfmtrc.json` if the new version requires it.
- Bump the package version (patch) per the repo's versioning rule.

No runtime, bundle, or user-facing behavior changes: `oxfmt` is a dev-only formatting tool and the distributable is byte-identical apart from being built from reformatted sources.

## Capabilities

### New Capabilities

(none — this is a pure dev-tooling update with no spec-level behavior change; the change declares `skip_specs: true`)

### Modified Capabilities

(none — no existing requirement changes; the format tooling is not covered by a spec capability)

## Impact

- `package.json` / `pnpm-lock.yaml`: `oxfmt` `0.16.0` → `0.68.0`, version patch bump.
- `.oxfmtrc.json`: possibly extended if 0.68.0 requires or recommends new settings (`printWidth: 120` is expected to carry over).
- Repository-wide formatting churn across `src/`, `scripts/`, `test/`, `rolldown.config.ts` — cosmetic only.
- CI: no workflow changes needed; it does not run `format:check`, and the other four gates must keep passing.
- This is change 1 of 3 in the progressive dependency refresh (`update-oxfmt` → `update-vitest` → `update-typescript`); doing it first means later changes review diffs that are already in canonical 0.68.0 form.
