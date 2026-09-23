# Tasks

## 1. Failing fixtures first

- [x] 1.1 Add matcher repro fixtures to `test/matcher-core.test.ts` (4×A/3-held → exactly 1 swap with no held copy sent; 4×A/2-held → exactly 2 swaps) and verify they fail on the current `tradableRemaining > target` gate via `pnpm test`
- [x] 1.2 Add eligibility/precheck fixtures to `test/tradable.test.ts` (5×A/4-held is now a candidate with 1 offerable; owned-at-target with tradable copies stays excluded; all-held stays excluded) and verify they fail on the current `tradable > target` gate via `pnpm test`

## 2. Core implementation

- [x] 2.1 Switch the `src/lib/matcher-core.ts` give-check to `owned > target AND tradableRemaining ≥ 1` (cap `min(tradable, owned − target)`), keeping dual-decrement bookkeeping, and verify the new 1.1 fixtures pass via `pnpm test`
- [x] 2.2 Switch the `src/lib/tradable.ts` `buildScanEligibility` offerable gate and the badge swap-possibility precheck to the same predicate, and verify the new 1.2 fixtures pass via `pnpm test`
- [x] 2.3 Update outdated expectations in existing suites (`test/matcher-core.test.ts`, `test/matcher-core-golden.test.ts`, `test/tradable.test.ts`, `test/scan-lifecycle.test.ts` as affected) to the retained-owned rule and verify the full suite passes via `pnpm test`

## 3. Verification and release hygiene

- [x] 3.1 Run the repo gates (`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`) and verify all pass with no `dist/` file committed
- [x] 3.2 Sync the surplus wording in `AGENTS.md`/`README.md` (`max(tradable − target, 0)` → retained-owned formula) and bump the `package.json` patch version, and verify with `pnpm format:check` plus a diff review of the docs
