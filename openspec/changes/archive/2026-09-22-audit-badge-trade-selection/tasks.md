# Tasks

## 1. Fixture-first audit coverage (red)

- [x] 1.1 Add a strict-surplus matcher fixture — user owns five copies of one card with only one tradable, one held copy of a second card, zero of the rest; partner holds two of every card — asserting ZERO swaps; verify `pnpm test` fails because the current matcher proposes one swap
- [x] 1.2 Add a partial-surplus fixture (owned 4 / tradable 2 / target 1 → exactly one swap) and an owned-count-fallback fixture (cards with owned counts only → capacity equals owned copies above the target); verify these fail or are pending against the current matcher
- [x] 1.3 Add partner retain-one fixtures for both ANY-mode and fair partners — partner owns exactly one copy of a card the user needs → no swap proposes taking it; verify both fail against the current matcher (`count > 0` allows it today)
- [x] 1.4 Add eligibility fixtures for `buildScanEligibility`: badge with missing cards whose only duplicate is the last tradable copy (owned 5 / tradable 1) is EXCLUDED, badge with a fully tradable duplicate plus gaps is INCLUDED, all-held badge is EXCLUDED; verify `pnpm test` reports failures against the current unbalanced+has-tradable gate

## 2. Matcher give rule (strict surplus)

- [x] 2.1 In `src/lib/matcher-core.ts`, replace the give condition (owned above target AND at least one tradable) with the single strict condition "tradable remainder exceeds the state's applicable target" (`maxSets` in state 0, `lastSet` in state 1), leaving the receive condition untouched; verify the fixtures from 1.1/1.2 pass and the existing full-capacity, fairness, and per-game-balance tests stay green
- [x] 2.2 Keep the single-pass post-trade accounting (send decrements owned + tradable, receive increments both) unchanged and verify the multi-iteration and determinism tests in `test/matcher-core.test.ts` still pass
- [x] 2.3 Update the reference loop in `test/matcher-core-golden.test.ts` in lockstep (give condition + updated expectations: last-tradable scenario → zero swaps, fully tradable → three swaps); verify `pnpm test` passes with the golden suite agreeing with the real matcher

## 3. Partner retain-one rule

- [x] 3.1 In `src/lib/matcher-core.ts`, add the partner give condition — partner's tradable count for the card they send (falling back to owned count) must be greater than one — applied to ALL partners before the existing fairness/ANY branch, keeping the fair-bot "must not worsen their badge state" check and its ANY-mode exemption as-is; verify the fixtures from 1.3 pass while the "Unfair-to-bot swap is rejected" and "ANY-mode bot accepts uneven swaps" tests remain green

## 4. Eligibility gate (receivable + surplus)

- [x] 4.1 Rewrite `buildScanEligibility` in `src/lib/tradable.ts` to zero-fill the badge's slots to the set size, compute `maxSets = floor(total/size)` and `lastSet = ceil(total/size)` with the badge-page formula, pick the applicable target with the same state rule the matcher uses, and mark a badge eligible iff some slot is below the target AND some slot has `tradable > target` (tradable falls back to owned when unknown); verify the fixtures from 1.4 pass and `pnpm test` is green
- [x] 4.2 Add a gate/matcher parity fixture running the same badge through `buildScanEligibility` and `computeMatches` (gate excludes ⇒ matcher yields no swaps even with a generous partner; gate includes ⇒ matcher proposes at least one swap); verify the parity test passes

## 5. Docs, validation, and release hygiene

- [x] 5.1 Update `README.md` and, where it describes matching/eligibility, `AGENTS.md` to the strict surplus (`max(tradable − target, 0)`) and the receivable+surplus bot-search gate (docs-sync rule); verify no stale wording remains by searching both files for the old "at least one tradable copy" gate / raw tradable-capacity phrasing
- [x] 5.2 Bump the `package.json` version (patch minimum — required for any `src/`/`test/` change); verify the new version is greater than the previous one and that the build injects it into the userscript header
- [x] 5.3 Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build`; verify all four pass and `dist/ASF-STM.user.js` exists with no `{{PLACEHOLDER}}` tokens or `// DEBUG` markers
- [x] 5.4 Run `openspec validate --change "audit-badge-trade-selection" --strict`; verify it passes with both delta specs resolving their modified requirements
