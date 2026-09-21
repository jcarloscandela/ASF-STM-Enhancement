# Tasks

## 1. Models and tradability helpers

- [x] 1.1 Add optional `tradableCount` to `MatchCard` in `src/lib/models.ts` (single declaration site, documented as "currently tradable copies; undefined = unknown, treat as count") and verify `pnpm typecheck` passes with no other edits
- [x] 1.2 In `src/lib/tradable.ts`, adjust `resolveOwnedCount` usage docs (fallback role moves to filling `tradableCount`) and relax `buildScanEligibility`: replace the `size < max_size && min > 0` guard with `size < max_size && count > 0`; verify with a new `test/tradable.test.ts` case where one card has a tradable copy and the rest are missing (badge becomes eligible) and a case where all copies are held (badge stays excluded)

## 2. Matcher core (owned need, tradable capacity)

- [x] 2.1 In `src/lib/matcher-core.ts`, initialize a per-slot `tradableRemaining = tradableCount ?? count` on the user's cloned badge and gate the give check on `tradableRemaining > 0` in addition to the existing owned-surplus condition; update the module header comment (behavior is no longer verbatim-unchanged)
- [x] 2.2 Decrement `tradableRemaining` on each proposed send and increment it on each proposed receive, keeping the invariant `tradableRemaining <= count`; verify no mutation of input badges via the existing "does not mutate the input badges" test
- [x] 2.3 Add `test/matcher-core.test.ts` cases for the reported scenarios: (a) 5 tradable A + 1 held D, missing B/C/E, partner holds 2 of each → exactly A→B, A→C, A→E and no request for D; (b) same but only 1 of the 5 A copies tradable → exactly one swap; (c) no `tradableCount` fields → behavior identical to pre-change fixtures; verify with `pnpm test`

## 3. Scanner wiring

- [x] 3.1 In `src/ASF-STM.ts` `GetOwnCards`, set `count` to the badge-page `owned` value always and `tradableCount` from the `tradableCardCounts` lookup (omit when unknown); verify the debug build logs owned vs tradable counts per card
- [x] 3.2 Confirm the nothing-to-match filter and `maxSets`/`lastSet` computation operate on the restored owned counts (expected to need no code change per design D3) and that a badge matching scenario (b) above survives the filter; verify by tracing the debug scan output for a fixture badge
- [x] 3.3 Verify match rows display only exchanged cards: offered side shows the capped tradable copies and requested side excludes owned cards, using the scenario fixtures through `addMatchRow`/`populateCards` rendering (manual or fixture-based check)

## 4. Golden and regression tests

- [x] 4.1 Update the reference implementation in `test/matcher-core-golden.test.ts` to the owned/tradable rules and extend its exhaustive small fixtures with held-copy cases; verify `pnpm test` passes
- [x] 4.2 Run `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test` and fix any fallout; run `pnpm build` and confirm `dist/ASF-STM.user.js` builds with no `{{PLACEHOLDER}}` tokens or `// DEBUG` markers

## 5. Docs, version, and validation

- [x] 5.1 Update the matching-behavior description in `README.md` (and `AGENTS.md` if it documents matcher behavior) to state: requests use owned counts, offers use currently tradable copies, badge-page fallback unchanged
- [x] 5.2 Bump the `package.json` version (patch at minimum) per repo rules
- [x] 5.3 Run `openspec validate fix-matcher-tradable-counts` and resolve any reported issues
