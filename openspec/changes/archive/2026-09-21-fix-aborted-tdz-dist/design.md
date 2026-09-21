# Design

## Context

See proposal.md Why. `GetOwnCards()` (`src/ASF-STM.ts`) calls hoisted `finish()` on the zero-pending path before `let aborted = false` executes (TDZ). Distribution is fixed: `rolldown.config.ts` bundles `src/ASF-STM.ts` + `src/lib/*.ts` + templates into single `dist/ASF-STM.user.js` with Tampermonkey metadata banner and version define — so the fix ships through the standard Tampermonkey/GreasyFork flow, no alternative needed.

## Goals / Non-Goals

**Goals:**
- Fix the TDZ crash with a minimal source edit and ship it as the normal single-file artifact Tampermonkey/GreasyFork consumes.

**Non-Goals:**
- No change to fetch pacing, retry, circuit-breaker, matching, metadata matches, or grants; no new install method.

## Decisions

- **Hoist `let aborted = false` (with `pendingIndex`) above Phase-1 derivation/early return** over `var`, `typeof` guards, or restructuring `finish`. Rationale: smallest diff, keeps `let` semantics and existing abort wiring; other options add lint risk or obscure flow.
- **Stay on the single-file Tampermonkey pipeline** (source fix → `pnpm build` → release asset → GreasyFork/Tampermonkey update) over any alternative distribution. Rationale: the bug is pure declaration order in shipped JS; the pipeline already produces the exact installable file, so no new mechanism is required.
- **Fixture-level regression test** (zero-pending path, no browser/network) over manual Tampermonkey verification. Rationale: matches repo vitest conventions; Tampermonkey update is covered by the existing build/release verification.

## Risks / Trade-offs

- [Risk] Users stay on the cached broken copy after reinstall confusion → Mitigation: patch version bump drives Tampermonkey/GreasyFork update detection; release carries the single fixed asset.
- [Risk] Similar use-before-let elsewhere in scan flow → Mitigation: task includes a scan-flow grep check.
- [Risk] Bundled line numbers shift, invalidating pasted stack-trace refs → Mitigation: informational only; no action.

## Migration Plan

Land fix + test + patch bump; CI verifies; release publishes fixed `ASF-STM.user.js`; users update/reinstall via Tampermonkey/GreasyFork. Rollback is a version revert.
