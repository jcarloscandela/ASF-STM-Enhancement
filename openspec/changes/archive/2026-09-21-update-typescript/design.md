# Design

## Context

`typescript` is used exactly once: `pnpm typecheck` runs `tsc --noEmit` over `src/`, `test/`, `scripts/` with strict settings (`strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `skipLibCheck`, `moduleResolution: "bundler"`, `target/lib ES2022 + DOM`). Nothing consumes the compiler programmatically: `rolldown` bundles via its own oxc transform, `@oxc-node/core/register` strips types itself, `oxlint` parses independently, and `vitest` runs under the oxc hook. The executable paths (`tsc`/`tsserver`) are only invoked by humans and CI. TS 6 is the transitional major between the JS-based `5.9` line and the native (Go) `7.x` line. See proposal.md — Why.

## Goals / Non-Goals

**Goals:**
- Reach `typescript@7.0.2` with `pnpm typecheck` green at each committed step and the rest of the gate set (`lint`, `format:check`, `test`, `build`) untouched and passing.
- Preserve the type-checking bar: strict mode and the existing strictness flags stay; no loosening to make errors disappear.
- Keep the exported Steam-payload type contracts (exported types in `src/lib/`) identical in meaning; edits allowed only where the new compiler demands them.

**Non-Goals:**
- Adopting TS 6/7 language features in source code (a compatibility upgrade, not a modernization of the code).
- Enabling `declaration`/`outDir` emits to be used anywhere (`build/` is not consumed; `noEmit` on the CLI governs the gate; consider whether these vestigial options still belong after the upgrade — remove only if 6/7 deprecates them).
- Touching `rolldown`, `@oxc-node`, `oxlint`, or `zod` versions (all already latest).

## Decisions

- **Two-step climb (5.9 → 6.0.x → 7.0.2), one commit each.** Mirrors the vitest change: each major's fallout is attributable to one upgrade guide, and a green 6.0.x state is a rollback point. Alternative: single jump — rejected for bisection reasons and because 6.x deprecation messages specifically ease the 7.x migration.
- **Treat TS 7 as a drop-in replacement for the `tsc --noEmit` gate, verified before committing.** The native compiler keeps the CLI surface (`tsc --noEmit`, tsconfig support). Verify on Windows x64 in step B before commit; expect faster runs. If a blocking incompatibility appears (config option unsupported, different module resolution verdicts), surface it to the user instead of pinning back to 6.x silently — the user chose "all the way to latest" knowing 7 is the native compiler.
- **Fix new type errors at the source, not the config.** New diagnostics from TS 6/7 are fixed in the code they point at (narrowing, correct null handling, updated lib typings vs `@types/node@26`). The only acceptable `tsconfig.json` edits are options the new majors removed/renamed/repurposed. Alternative: adding `skipLibCheck`-style suppressions beyond what exists — rejected, erodes the gate.
- **`skipLibCheck: true` stays** — it already scopes lib-level churn; the DOM/ES2022 libs and `@types/node` are external surfaces where third-party type drift is not our bug to fix.
- **Interaction check after each step:** run the full gate set, not just typecheck — `verbatimModuleSyntax` and resolution changes could theoretically alter what oxlint/rolldown see, so all five gates are the definition of "green".

## Risks / Trade-offs

- [TS 6/7 flags new type errors across `src/`/`test/`/`scripts/` (stricter inference, changed lib typings)] → Expected scope; fix minimally per decision above, commit per step, keep behavior identical; golden test (`test/matcher-core-golden.test.ts`) guards runtime behavior.
- [TS 7 native compiler drops or changes a used tsconfig option or resolution behavior] → Read the 6.x deprecation list in step A and pre-migrate; in step B, if `tsc --noEmit` misbehaves in a way 6.0.x did not, stop and surface to the user rather than pinning back silently.
- [Diagnostic output format changes confuse contributors only] → Accept; nothing in scripts/CI parses tsc output.
- [@types/node@26 or DOM lib interplay produces noise under the new lib versions] → Triage: real contract bugs get fixed; third-party type noise gets isolated (narrow casts at the boundary) or reported upstream; `skipLibCheck` already bounds most of it.
- [Native compiler availability/perf issue on this Windows machine] → Verify immediately in step B (`npx tsc --version` + full typecheck); rollback point is the committed green 6.0.x state.

## Migration Plan

1. Step A: bump to latest stable `6.0.x`, refresh lockfile, read the 6.x release/deprecation notes, run `pnpm typecheck`; fix errors/deprecations minimally; run the full gate set; bump version (patch); commit.
2. Step B: bump to `7.0.2`, same loop including an explicit `tsc --noEmit` behavior comparison; bump version (patch); commit.
3. Rollback: revert the corresponding commit; each step's end state is fully green.

## Open Questions

(none)
