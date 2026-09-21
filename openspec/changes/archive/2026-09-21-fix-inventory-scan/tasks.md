# Tasks

## 1. Resilience lib (steam-cards-bot patterns, pure and unit-tested)

- [x] 1.1 Create `src/lib/resilience.ts` with `classifySteamError(status, errorText)` (RateLimited / Auth / Transient / Unknown: 429 and Steam rate-limit body -> RateLimited; session/auth signals -> Auth; network/timeout/5xx -> Transient) as a pure function; verify with new `test/resilience.test.ts` fixtures
- [x] 1.2 In `src/lib/resilience.ts`: add a `RateLimitCircuitBreaker` pure state machine (injectable clock): consecutive rate-limited failures >= threshold opens for an exponentially growing, capped cooldown; success resets; open breaker fails fast (retryable error, no network attempt); verify with `test/resilience.test.ts` (open, recovery after cooldown, reset-on-success, cap) and `pnpm test`
- [x] 1.3 Export the taxonomy/clock types from the new lib; keep zero runtime dependencies; verify with `pnpm typecheck && pnpm lint`

## 2. Scan-flow integration

- [x] 2.1 In `src/ASF-STM.ts` `fetchInventory`: classify page-loop failures (HTTP status/JSON errors) and gate new page requests behind the breaker so a rate-limit window fails fast with a retryable error instead of aborting the run silently; keep the run-id supersession guard ahead of retry scheduling; verify with `pnpm typecheck` and a read-through of the loop paths (success, HTTP error, superseded run)
- [x] 2.2 In `src/ASF-STM.ts` `GetOwnCards` badge-detail workers: classify XHR failures (status + response text) to decide retry vs. hard abort per the existing per-badge/global budget rules, and gate worker launches behind the breaker; keep per-badge settle semantics and `retryDelay()` as the only delay formula; verify with `pnpm typecheck` plus a read-through of the worker lifecycle (launch/settle/abort/retry)
- [x] 2.3 In `src/ASF-STM.ts` `GetCards` bot fetches: apply the same classification for retry vs. abort and gate launches behind the breaker; verify with `pnpm typecheck` and `pnpm test` (helper/lib suites)

## 3. End-to-end verification of the default inventory scan

- [x] 3.1 Verify the default path end-to-end on the integrated code: inventory mode resolves as the unconditional default, the fetch pages until exhaustion with pacing, badges-database eligibility feeds the parallel detail stage, and failures abort explicitly with no badge-page fallback; verify with the full `pnpm test` suite and a grep confirming no badge-page discovery requests on the inventory path
- [x] 3.2 Verify breaker/classifier semantics compose with the shared retry computation in the flows: rate-limited/transient retry within budgets, auth/unknown abort, success resets; verify via `test/resilience.test.ts` combined-semantics cases and `pnpm test`

## 4. Gates, docs, and release

- [x] 4.1 Run the full gate set (`pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm build`); verify `dist/ASF-STM.user.js` builds with no unreplaced placeholders and no `// DEBUG` markers
- [x] 4.2 Update `README.md` (scan resilience behavior: classification, fail-fast during rate-limit windows, automatic recovery) and `AGENTS.md` (layout mention of `src/lib/resilience.ts`) per the docs-sync rule; verify no stale scan-flow statements remain
- [x] 4.3 Bump the package version in `package.json` (patch minimum from the current value) per the versioning rule; verify the header version in a fresh `pnpm build` output matches
