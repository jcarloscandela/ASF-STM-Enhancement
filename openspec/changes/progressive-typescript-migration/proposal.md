# Proposal

## Why

`src/ASF-STM.js` is a ~2123-line single-file userscript with only two extracted TypeScript libs (`tradable`, `settings`). The remaining matching, scanning, config, and DOM logic is untyped, untested plain JS, so Steam payload shape changes and refactors fail silently at runtime. Migrating progressively to small, tested TS libs with runtime validation removes that risk without a risky big-bang rewrite.

## What Changes

- Add `zod` (dev/runtime-safe, single-file-inline compatible) as the runtime-validation library for Steam payloads and settings; export inferred TS types as the contract between fixtures, tests, and the bundle.
- Add `src/lib/steam-schema.ts`: Zod schemas + inferred types for Steam inventory descriptions/assets, badge `rgCards` entries, bot-list entries, and trade-offer items; lenient (strip unknown keys, coerce `0/1`/`"0"/"1"` flags) so Steam additions never break the scan.
- Add `src/lib/matcher-core.ts`: pure, DOM-free trade-matching core extracted from `ASF-STM.js` (`calcState`, match accumulation, `storeMatches` payload building); no XHR/DOM/GM calls.
- Extend `src/lib/settings.ts` (+ new `src/lib/config.ts` if warranted): Zod-validated settings schema, typed defaults, safe `LoadConfig` merge that preserves stored values and fills new keys.
- Generalize `scripts/build.ts` lib-inlining from the hardcoded 2-entry list to a directory-driven `src/lib/*.ts` list so new libs need no builder edits; keep single-file `dist/` output and `// DEBUG` stripping unchanged.
- Coverage: new vitest fixtures per lib (no browser/network, no new runtime deps beyond `zod`); `pnpm typecheck/lint/test/build` all green.
- No user-visible behavior change: matching results, scan modes, config dialog, and trade-offer flow stay identical.

## Capabilities

### New Capabilities

- `steam-payload-schema`: Zod schemas and inferred TypeScript types for Steam inventory, badge, bot-list, and trade-offer payloads; runtime parse/validate entry points used at network boundaries.
- `matcher-core`: Pure trade-matching core (badge state, card matching, match-store building) as a tested TypeScript lib free of DOM/network side effects.
- `scanner-config`: Validated settings/config handling (typed defaults, merge-with-defaults, scan-plan resolution) as a tested TypeScript lib.

### Modified Capabilities

- `userscript-build`: build MUST inline every `src/lib/*.ts` lib generically (not a hardcoded list), compile Zod-based libs into the single-file bundle, and keep typecheck/lint/test/build green with the new dependency.

## Impact

- Code: `src/lib/*` (new `steam-schema.ts`, `matcher-core.ts`, extended `settings.ts`), `src/ASF-STM.js` (thin wrappers over the libs), `scripts/build.ts` (generic lib discovery), `tsconfig.json` (unchanged strictness), `test/*` (new fixture suites).
- Dependencies: adds `zod` (only new runtime dep; everything else stays dev-only). Evaluated and rejected: `arktype`/`valibot` (smaller but less familiar to contributors), `io-ts` (verbose), hand-rolled guards (what `tradable.ts` does today — doesn't scale to badge/bot payloads).
- Systems: `pnpm build/test/typecheck/lint` and CI (`.github/workflows/build.yml`) unchanged in shape; `dist/` stays gitignored and single-file.
