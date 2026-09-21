# Design

## Context

See `proposal.md` (Why) for motivation. Current state: `src/ASF-STM.ts` (~2300 lines, strict TypeScript) holds matching (`calcState`, `compareCards`, `storeMatches`), scanning (`GetOwnCards`, `GetCards`), config (`LoadConfig`, `SaveConfig`), and DOM/trade-offer code in one file, bundled by rolldown into the single `dist/ASF-STM.user.js` with `src/lib/*.ts` as normal imports (no builder script, no placeholders). Strict-TS libs exist (`src/lib/tradable.ts`, `src/lib/settings.ts`, the latter also owning scan-plan routing). `tsconfig.json` is `strict` + `noUncheckedIndexedAccess`. Tests are vitest with plain fixtures. Constraint: `dist/` must stay a single self-contained file; no new network/DOM runtime deps in the bundle.

## Goals / Non-Goals

**Goals:**

- Establish a repeatable slice pattern: each migration slice = one `src/lib/<name>.ts` + fixtures + thin `ASF-STM.ts` wrapper, independently reviewable.
- Give every Steam boundary (inventory, badge `rgCards`, bot list, trade-offer items) a validated type so malformed payloads skip entries instead of breaking scans.
- Keep `pnpm typecheck/lint/test/build` green at every slice; no flag-day rewrite.

**Non-Goals:**

- No DOM/config-dialog rewrite, no scan-orchestration async refactor, no template-system or bundler-config changes.
- No behavior change to matching results, scan modes, or trade-offer flow (equivalence is tested, not redesigned).
- No bundler introduction or replacement; rolldown stays as-is, new libs arrive via normal imports.

## Decisions

### 1. `zod` for runtime validation + inferred static types

Schemas live in `src/lib/steam-schema.ts` (and a settings schema in the config lib); `z.infer<>` is the exported TS type so fixtures, tests, and bundle share one contract. Lenient by default: `.strip()` unknown keys, `.passthrough()` never; coerce `TradableFlag` (`boolean | 0/1 | "0"/"1"`) via union + transform; `safeParse` at XHR response boundaries, fail-open per existing tradability semantics (skip entry / fall back to badge `owned`).

Alternatives: `valibot` (smaller bundle, less contributor familiarity), `arktype` (concise but newer API churn), `io-ts` (verbose), hand-rolled guards (status quo — doesn't scale to badge/bot shapes). Zod wins on familiarity, error reporting for debug builds, and `safeParse` ergonomics.

### 2. Three small libs, migrated in dependency order

1. `steam-schema.ts` — no dependencies; pure schemas + `parse*` helpers. Unblocks everything.
2. Extend `settings.ts` in place (decided: the file is small and already owns defaults, merge, plan, and routing) — depends only on schema primitives; typed defaults + `mergeWithDefaults` + `resolveScanPlan` with per-key fallback.
3. `matcher-core.ts` — depends on steam-schema types only; pure functions (`calcBadgeState`, `findMatch`, `buildMatchStore`) extracted from the typed `compareCards`/`calcState`/`storeMatches` in `src/ASF-STM.ts` with no logic changes. No DOM, XHR, `GM_*`, or `localStorage`.

Each lib bundles via the existing rolldown imports; `ASF-STM.ts` keeps thin wrappers so the userscript diff per slice is small and reviewable.

### 3. Zod, pruned to `zod/mini` (measured)

`import { z } from "zod"` bundles through rolldown with no builder edits, but the measured delta is **+126 KB** (105,571 → 231,829 bytes) — unbundled tree-shaking keeps the full Zod core. Decision: use **`zod/mini`** (`import { z } from "zod/mini"`), whose functional API is separately tree-shakeable. Measured: **+5.5 KB** for a trivial schema (105,571 → 111,115 bytes); the real `steam-schema.ts` lib measures **+37.9 KB** (105,571 → 143,470 bytes, ~+36%) once inventory/badge/bot validators are included — still well under the 50 KB gzipped budget, with 0 placeholders and `pnpm typecheck` green.

### 4. Equivalence testing per slice

Each lib ships a vitest suite with plain fixtures copied from real Steam shapes (held/foil/unknown-field/malformed variants). `matcher-core` gets a determinism test: same inputs → same outputs, plus a golden test against the current `compareCards` behavior in `src/ASF-STM.ts` on 2–3 representative badges before the wrapper swap.

## Risks / Trade-offs

- [Zod bundle size inflates the userscript] → **Measured: full Zod adds +126 KB; `zod/mini` adds only +5.5 KB (105,571 → 111,115 bytes).** Ship `zod/mini`; fall back to scoped hand-rolled guards only if a future schema pulls the full core back in.
- [Oxc runner strips types without checking; Zod misuse ships silently] → Mitigation: CI `typecheck` stays mandatory; `safeParse` return values must be asserted in tests.
- [Behavior drift during extraction] → Mitigation: move code without logic changes first, golden-equivalence tests, wrapper swap only when green; no logic "improvements" inside migration slices.
- [Steam changes payload shapes] → Mitigation: lenient schemas + skip-entry semantics; new-field fixture added when observed.

## Migration Plan

Slices land independently, each bumping `package.json` patch per AGENTS.md versioning rule:

1. Deps + `steam-schema.ts` + tests (record bundling approach and `dist/` size delta).
2. `settings.ts` validation + tests + `LoadConfig` wrapper swap.
3. `matcher-core` extraction + golden tests + `compareCards`/`calcState`/`storeMatches` wrapper swap.
4. Docs sync (`AGENTS.md`/`README.md` lib list) and CI verification (`typecheck`, `lint`, `test`, `build`, no `{{PLACEHOLDER}}` in `dist/`).

Rollback per slice: revert the single lib + wrapper commit; bundle is regenerated, so no `dist/` commit needed.

## Open Questions

None.
