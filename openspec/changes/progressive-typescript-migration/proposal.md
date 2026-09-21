# Proposal

## Why

`src/ASF-STM.ts` is a ~2300-line single-file userscript, now fully TypeScript with two extracted libs (`tradable`, `settings`) plus routing. The remaining matching, scanning, and config logic is typed but its Steam payload shapes are unvalidated at runtime, so Steam response changes and refactors fail silently at runtime. Adding small, tested libs with Zod runtime validation removes that risk without a risky big-bang rewrite.

## What Changes

- Add `zod` as the runtime-validation library for Steam payloads and settings; it bundles into the single file via the normal rolldown import, and inferred TS types are the contract between fixtures, tests, and the bundle.
- Add `src/lib/steam-schema.ts`: Zod schemas + inferred types for Steam inventory descriptions/assets, badge `rgCards` entries, bot-list entries, and trade-offer items; lenient (strip unknown keys, coerce `0/1`/`"0"/"1"` flags) so Steam additions never break the scan.
- Add `src/lib/matcher-core.ts`: pure, DOM-free trade-matching core extracted from `src/ASF-STM.ts` (`calcState`, match accumulation, `storeMatches` payload building); no XHR/DOM/GM calls.
- Extend `src/lib/settings.ts` in place: Zod-validated settings schema, typed defaults, safe `LoadConfig` merge that preserves stored values and fills new keys.
- Coverage: new vitest fixtures per lib (no browser/network, no new runtime deps beyond `zod`); `pnpm typecheck/lint/test/build` all green.
- No user-visible behavior change: matching results, scan modes, config dialog, and trade-offer flow stay identical.

## Capabilities

### New Capabilities

- `steam-payload-schema`: Zod schemas and inferred TypeScript types for Steam inventory, badge, bot-list, and trade-offer payloads; runtime parse/validate entry points used at network boundaries.
- `matcher-core`: Pure trade-matching core (badge state, card matching, match-store building) as a tested TypeScript lib free of DOM/network side effects.
- `scanner-config`: Validated settings/config handling (typed defaults, merge-with-defaults, scan-plan resolution) as a tested TypeScript lib.

### Modified Capabilities

- `userscript-build`: build MUST bundle the declared validation dependency into the single self-contained file (no new runtime network/DOM dependencies) and keep typecheck/lint/test/build green with the new dependency.

## Impact

- Code: `src/lib/*` (new `steam-schema.ts`, `matcher-core.ts`, extended `settings.ts`), `src/ASF-STM.ts` (thin wrappers over the libs), `rolldown.config.ts` (unchanged — new libs bundle via normal imports), `tsconfig.json` (unchanged strictness), `test/*` (new fixture suites).
- Dependencies: adds `zod` (only new runtime dep; everything else stays dev-only). Evaluated and rejected: `arktype`/`valibot` (smaller but less familiar to contributors), `io-ts` (verbose), hand-rolled guards (what `tradable.ts` does today — doesn't scale to badge/bot payloads).
- Systems: `pnpm build/test/typecheck/lint` and CI (`.github/workflows/build.yml`) unchanged in shape; `dist/` stays gitignored and single-file.
