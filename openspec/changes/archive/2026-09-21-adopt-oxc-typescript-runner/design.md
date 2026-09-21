# Design

## Context

See proposal.md (Why). Current state: `package.json` runs `build` via `tsx scripts/build.ts`; tests via `vitest run` (Vite/esbuild transform); lint/format already on Oxc (`oxlint`, `oxfmt`); type gate is `tsc --noEmit`. `scripts/build.ts` uses `typescript.transpileModule` from the `typescript` package to inline `src/lib/*.ts` — this is independent of which runner launches the script, but is a candidate for later consolidation. Target project is a single-package pnpm repo (`pnpm@12.3.4`, Node 22 in CI); planning home and code live in the same repo. Oxc runner docs (provided in request): `oxnode ./src/index.ts` CLI from `@oxc-node/cli`, `node --import @oxc-node/core/register` hook from `@oxc-node/core`, `OXC_TSCONFIG_PATH`/`TS_NODE_PROJECT` override, `OXC_TRANSFORM_ALL=1` for `node_modules`, no type-checking. Runner is experimental — see Risks.

## Goals / Non-Goals

**Goals:**
- Replace `tsx` with the Oxc runner for the default `pnpm build` / `pnpm test` paths with output parity.
- Keep command names stable (`pnpm build`, `pnpm test`, `pnpm typecheck`, `pnpm lint`) so CI and docs churn minimally.
- Pin the experimental dependency and document rollback.

**Non-Goals:**
- Rewriting `scripts/build.ts` inlining to use Oxc transform APIs (only if a compat issue forces it; prefer minimal diff).
- Migrating lint/format (already Oxc) or changing `dist/` artifact layout, version-sourcing, or release flow.
- Adding type-checking to the runner (out of scope by Oxc design; `tsc --noEmit` stays).

## Decisions

- **Decision: Prefer `@oxc-node/core` register hook for `build`, keep `oxnode` for dev/watch.**
  Rationale: `node --import @oxc-node/core/register scripts/build.ts` composes with stock `node` flags and CI with no new binary semantics; `oxnode --watch` is the ergonomic dev loop (passthrough to Node watch). Alternative considered: `oxnode` everywhere — rejected for CI because hook form keeps `node` as the process owner and matches Oxc docs for `--test` composition. Final script shape decided in implementation; both packages may be installed (`cli` pulls `core` semantics) or just `core` if `oxnode` ergonomics aren't needed.
- **Decision: Output-parity gate before removing `tsx`.**
  Rationale: experimental runner must prove byte-identical `dist/` outputs at the same revision. Keep `tsx` as a dev fallback until parity is demonstrated on Windows + CI Linux, then remove it. Alternative (flag-day removal) rejected as too risky for an experimental dep.
- **Decision: Leave `typescript.transpileModule` in `scripts/build.ts` untouched unless blocked.**
  Rationale: that call is plain library use inside the script, not the runner; changing it expands blast radius (inlined lib output must stay identical, including `export` stripping and module-syntax guard). Alternative (switch to Oxc transform sync/async APIs now) deferred to a follow-up once the runner itself is stable.
- **Decision: No `vitest` transform migration in this change.**
  Rationale: vitest already runs the suite; only verify it passes under the Oxc-launched environment and note any config shim. Swapping vitest's internal pipeline is a separate change.

## Risks / Trade-offs

- [Risk] Experimental API/behavior drift between releases → Mitigation: exact version pin in `package.json` + `pnpm-lock.yaml`, Dependabot/pnpm update policy note, rollback command to `tsx`.
- [Risk] `tsconfig.json` option gaps (JSX/decorators/class-fields/import-rewrite) vs `tsx` → Mitigation: this repo's `tsconfig` is plain ESM/ES2022 with no decorators/JSX, so surface is small; verify `module`, `moduleResolution: bundler`, `verbatimModuleSyntax` behavior in parity check.
- [Risk] ESM/CJS inference differences for `.js/.ts` mixed sources → Mitigation: repo is `"type": "module"` with `.ts` sources only outside `src/ASF-STM.js`; parity diff catches it.
- [Risk] `node --import` requires Node ≥ 20.6 semantics (CI uses Node 22, fine) but local dev may vary → Mitigation: document minimum Node version in README; CI already pins 22.
- [Risk] Stack-trace/sourcemap fidelity differences → Mitigation: manual failure-injection check (`missing placeholder` path) during implementation.
- Trade-off: two Oxc packages (`cli` + `core`) vs one — accept small install-size cost for both ergonomics (CLI + hook); revisit if `core` alone suffices.

## Migration Plan

1. Add pinned `@oxc-node/cli` and/or `@oxc-node/core`; add parallel scripts (e.g. `build:oxc`) for side-by-side comparison.
2. Diff `dist/` outputs (Oxc vs `tsx`) at same revision; fix or report divergences.
3. Flip `build`/`test` scripts to the Oxc path; update CI (no step-name changes needed) and README.
4. Remove `tsx` dependency + lockfile entries; verify clean `pnpm install --frozen-lockfile`, `typecheck`, `lint`, `test`, `build` on Windows and CI Linux.
5. Rollback: revert `package.json` scripts to `tsx`, `pnpm install`; keep this design + specs as record. No data migration; `dist/` is regenerable.

## Open Questions

- None blocking. Version to pin (`@oxc-node/cli`/`core` latest at implementation time) and whether `cli` is needed in addition to `core` are resolved during implementation without changing specs or tasks.
