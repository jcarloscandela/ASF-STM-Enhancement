# Proposal

## Why

`vitest` is installed at `3.2.7` while `5.0.1` is current; the project sits two majors behind a test runner that releases majors roughly yearly. Falling further behind makes each future migration accumulate more release-notes debt at once. This is the second step of the progressive dependency refresh (after `update-oxfmt`), sized to stay reviewable while the largest upgrade (`typescript`) is deferred to its own change.

## What Changes

- Upgrade `vitest` from `3.2.7` to `5.0.1`, stepping through the last stable `4.x` first so the two majors' breaking changes land as separate, individually-verifiable commits:
  - Step A: `3.2.7` → latest stable `4.x`; fix any breaking changes in `vitest.config.ts` or the `test` script.
  - Step B: `4.x` → `5.0.1`; same verification.
- Keep the suite's shape unchanged: `test/**/*.test.ts`, `describe`/`it` imported from `vitest`, `node:assert/strict` assertions, no snapshot reliance identified.
- Preserve the Oxc transform path: the `test` script keeps launching vitest under `node --import @oxc-node/core/register` (required by the `typescript-runner` capability); if the vitest entry point moved between majors, re-point the script while keeping the hook.
- Bump the package version (patch) per the versioning rule.

No runtime or bundle changes: `vitest` is dev-only; the distributable and userscript behavior are untouched.

## Capabilities

### New Capabilities

(none — pure dev-tooling update; the change declares `skip_specs: true`)

### Modified Capabilities

(none — the `userscript-build` requirement ("unit-test suite run with `pnpm test` (vitest)… plain fixtures") and the `typescript-runner` requirements are version-agnostic and remain satisfied)

## Impact

- `package.json` / `pnpm-lock.yaml`: `vitest` `3.2.7` → `4.x` → `5.0.1`, version patch bump (twice if committed per step).
- `vitest.config.ts`: possibly adjusted for config-option renames/removals in v4/v5.
- `package.json` `test` script: possibly re-pointed if vitest's entry file moved (must keep the `@oxc-node/core/register` hook).
- CI: none needed; it runs the same `pnpm test` gate.
- Order dependency: apply after `update-oxfmt` so test-file edits are already in canonical format; `update-typescript` comes after, since a new `tsc` is the next riskiest gate.
