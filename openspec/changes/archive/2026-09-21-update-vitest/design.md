# Design

## Context

The suite is 9 plain-fixture test files under `test/` that import `describe`/`it` from `vitest` and assert with `node:assert/strict`; no snapshots, no custom matchers, no browser mocks. `vitest.config.ts` only sets `test.include: ["test/**/*.test.ts"]`. The `test` script is `node --import @oxc-node/core/register ./node_modules/vitest/vitest.mjs run` — vitest is deliberately launched through the Oxc register hook, and the `typescript-runner` capability requires tests keep executing via that transform pipeline. See proposal.md — Why.

## Goals / Non-Goals

**Goals:**
- Reach `vitest@5.0.1` with the full suite green at each committed step (4.x, then 5.0.1).
- Keep the documented command (`pnpm test`) and its exit-code semantics unchanged.
- Keep the Oxc register hook in the launch path.

**Non-Goals:**
- Migrating assertions from `node:assert/strict` to vitest's `expect` (works fine, out of scope).
- Adopting new v4/v5 features (projects/workspaces, new reporters) beyond what the config needs to keep working.
- Touching `typescript` (next change) or `oxfmt` (done previously).

## Decisions

- **Two-step major climb (3 → 4 → 5) instead of one jump.** Each major's breaking changes are then attributable to one release-notes document, and a green 4.x state is a safe rollback point. Alternative: single 3→5 jump — rejected; same total work but harder bisection, and the user asked for progressive splitting.
- **Keep the `@oxc-node/core/register` hook; adapt the entry path if needed.** If vitest 4/5 relocates or renames `vitest.mjs`, re-point the script to the new entry (or to the `vitest` bin while keeping `--import`). If the hook stops working with the new vitest, fall back to plain `vitest run` **only** if the `typescript-runner` capability's scenario ("all tests execute and pass via the Oxc transform pipeline") can still be satisfied — that is a spec-relevant outcome, so if the hook genuinely breaks, stop and surface it to the user rather than silently dropping it. Alternative: drop the hook because vitest transforms TS itself — rejected without checking, it would silently change the transform pipeline the spec pins.
- **Config changes only when the suite demands them.** Fix renames/removals flagged by vitest's own errors or upgrade guide; do not preemptively adopt new config idioms. Keep `include` semantics identical.
- **No test-content rewrites expected; if v4/v5 execution surfaces a real suite bug, fix it in the same step with its own commit.** The suite's plain-fixture style (no timers, no network, no browser) makes deep incompatibilities unlikely.

## Risks / Trade-offs

- [vitest 4/5 entry point moved, breaking the `test` script path `./node_modules/vitest/vitest.mjs`] → Verify `pnpm test` immediately after each bump; re-point the script in the same commit.
- [Oxc register hook incompatible with vitest 4/5 internals (double transform, module interception)] → Diagnose with a minimal repro; if unresolvable, stop and surface to the user (spec-relevant), instead of silently switching transform pipelines.
- [v4/v5 changes default behaviors (workers/pool, reporters) altering local output or CI log shape] → Acceptable cosmetic churn; only intervene if exit codes or failure reporting degrade.
- [Node engine requirement rises above Node 22] → CI and prerequisites currently require Node 22+; if a vitest major requires newer, surface the constraint to the user before changing prerequisites.
- [Two majors land with an interim state where 4.x is committed but 5 is not] → Acceptable and intentional; 4.x green is strictly better than 3.2.7 as a rollback point.

## Migration Plan

1. Step A: bump to latest stable 4.x, refresh lockfile, run `pnpm test`; fix config/script as needed; run the full gate set; commit (with version patch bump).
2. Step B: bump to `5.0.1`, same loop; commit (version patch bump again).
3. Rollback: revert the corresponding commit(s); steps are independent and each leaves the suite green.

## Open Questions

(none)
