# Design

## Context

See `proposal.md` (Why) for motivation. Current state: `src/ASF-STM.js` (~2123 lines) holds matching (`calcState`, `compareCards`, `storeMatches`), scanning (`GetOwnCards`, `GetCards`), config (`LoadConfig`, `SaveConfig`), and DOM/trade-offer code in one untyped file. Two strict-TS libs exist (`src/lib/tradable.ts`, `src/lib/settings.ts`), compiled via `transpileModule` and inlined by `scripts/build.ts` through a hardcoded 2-entry `LIBS` list plus `{{TRADABLE_LIB}}` / `{{SETTINGS_LIB}}` placeholders. `tsconfig.json` is `strict` + `noUncheckedIndexedAccess`. Tests are vitest with plain fixtures. Constraint: `dist/` must stay single-file userscripts with `// DEBUG` stripping; no new network/DOM runtime deps in the bundle.

## Goals / Non-Goals

**Goals:**

- Establish a repeatable strangler pattern: each migration slice = one `src/lib/<name>.ts` + fixtures + thin `ASF-STM.js` wrapper, independently reviewable.
- Give every Steam boundary (inventory, badge `rgCards`, bot list, trade-offer items) a validated type so malformed payloads skip entries instead of breaking scans.
- Keep `pnpm typecheck/lint/test/build` green at every slice; no flag-day rewrite.

**Non-Goals:**

- No DOM/config-dialog rewrite, no scan-orchestration async refactor, no template-system changes beyond generic lib discovery.
- No behavior change to matching results, scan modes, or trade-offer flow (equivalence is tested, not redesigned).
- No bundler introduction (no esbuild/rollup); the `transpileModule` + inline approach stays.

## Decisions

### 1. `zod` for runtime validation + inferred static types

Schemas live in `src/lib/steam-schema.ts` (and a settings schema in the config lib); `z.infer<>` is the exported TS type so fixtures, tests, and bundle share one contract. Lenient by default: `.strip()` unknown keys, `.passthrough()` never; coerce `TradableFlag` (`boolean | 0/1 | "0"/"1"`) via union + transform; `safeParse` at XHR response boundaries, fail-open per existing tradability semantics (skip entry / fall back to badge `owned`).

Alternatives: `valibot` (smaller bundle, less contributor familiarity), `arktype` (concise but newer API churn), `io-ts` (verbose), hand-rolled guards (status quo — doesn't scale to badge/bot shapes). Zod wins on familiarity, error reporting for debug builds, and `safeParse` ergonomics.

### 2. Three small libs, migrated in dependency order

1. `steam-schema.ts` — no dependencies; pure schemas + `parse*` helpers. Unblocks everything.
2. `scanner-config.ts` (extend `settings.ts` or new file) — depends only on schema primitives; typed defaults + `mergeWithDefaults` + `resolveScanPlan` with per-key fallback.
3. `matcher-core.ts` — depends on steam-schema types only; pure functions (`calcBadgeState`, `findMatch`, `buildMatchStore`) extracted verbatim from `compareCards`/`calcState`/`storeMatches`, then typed. No DOM, XHR, `GM_*`, or `localStorage`.

Each lib compiles standalone via the existing `transpileModule` path; `ASF-STM.js` keeps thin wrappers so the userscript diff per slice is small and reviewable.

### 3. Generic lib discovery in `scripts/build.ts`

Replace the hardcoded `LIBS` array with `readdirSync(LIB_DIR)` filtered to `*.ts` (sorted), mapping `<camelName>.ts` → `{{<SCREAMING_SNAKE>_LIB}}` via the existing `screamingSnakeToCamel` helper, and fail naming the missing placeholder. Zod must inline: since the bundle is single-file with no module loader, either (a) pre-bundle `zod` + libs with `esbuild` into an IIFE fragment before inline, or (b) vendor only the used validators. Spike first; default to (a) behind the existing `compileLibForInline` step. Placeholder discipline and `// DEBUG` stripping unchanged.

### 4. Equivalence testing per slice

Each lib ships a vitest suite with plain fixtures copied from real Steam shapes (held/foil/unknown-field/malformed variants). `matcher-core` gets a determinism test: same inputs → same outputs, plus a golden test against the current JS `compareCards` behavior on 2–3 representative badges before the wrapper swap.

## Risks / Trade-offs

- [Zod bundle size inflates the userscript] → Mitigation: measure `dist/` delta in the spike; if >~50KB gzipped, scope schemas to the minimal field sets and consider `zod/mini` or vendored guards.
- [`transpileModule` strips types without checking; Zod misuse ships silently] → Mitigation: CI `typecheck` stays mandatory; `safeParse` return values must be asserted in tests.
- [Behavior drift during extraction] → Mitigation: verbatim port first, golden-equivalence tests, wrapper swap only when green; no logic "improvements" inside migration slices.
- [Steam changes payload shapes] → Mitigation: lenient schemas + skip-entry semantics; new-field fixture added when observed.

## Migration Plan

Slices land independently, each bumping `package.json` patch per AGENTS.md versioning rule:

1. Deps + `steam-schema.ts` + tests + generic builder (spike Zod inlining first).
2. `scanner-config` validation + tests + `LoadConfig` wrapper swap.
3. `matcher-core` extraction + golden tests + `compareCards`/`calcState`/`storeMatches` wrapper swap.
4. Docs sync (`AGENTS.md`/`README.md` lib list) and CI verification (`typecheck`, `lint`, `test`, `build`, no `{{PLACEHOLDER}}` in `dist/`).

Rollback per slice: revert the single lib + wrapper commit; bundle is regenerated, so no `dist/` commit needed.

## Open Questions

- None blocking. Deferrable: whether `scanner-config` extends `settings.ts` in place or becomes `config.ts` (decide at implementation; spec is agnostic), and exact Zod inlining mechanism (spike decides, design stands either way).
