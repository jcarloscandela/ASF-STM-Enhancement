# Tasks

## 1. Counting pass and eligibility (finish the in-tree migration)

- [ ] 1.1 In `test/tradable.test.ts`: rewrite counting fixtures to the `InventoryCardData { owned, tradable }` shape (`buildInventoryCardCounts`): tradable-only, held-inclusive, mixed, foil/non-card exclusion, fail-open tradability; keep fixture style of the existing suite; verify with `pnpm typecheck`
- [ ] 1.2 In `test/tradable.test.ts`: rewrite eligibility fixtures pinning the owned-based hybrid rule per the spec delta: owned-unbalanced + at least one tradable copy scanned; all-held excluded; owned-balanced (all tradable) excluded; missing cards count as zero; verify with `pnpm test`
- [ ] 1.3 In `src/lib/tradable.ts`/`src/lib/models.ts`: remove any superseded tradable-only counting helpers/exports left from the migration and confirm the lib matches the models (`InventoryCardCounts`, `ScanEligibilityEntry.data` as owned/tradable data); verify with `pnpm typecheck && pnpm lint`

## 2. Resilience lib (steam-cards-bot patterns, pure and unit-tested)

- [ ] 2.1 Create `src/lib/resilience.ts` with `classifySteamError(status, errorText)` (RateLimited / Auth / Transient / Unknown: 429 and Steam rate-limit body -> RateLimited; session/auth signals -> Auth; network/timeout/5xx -> Transient) as a pure function; verify with new `test/resilience.test.ts` fixtures
- [ ] 2.2 In `src/lib/resilience.ts`: add a `RateLimitCircuitBreaker` pure state machine (injectable clock): consecutive rate-limited failures >= threshold opens for an exponentially growing, capped cooldown; success resets; open breaker fails fast (retryable error, no network attempt); verify with `test/resilience.test.ts` (open, half-open recovery, reset-on-success, cap) and `pnpm test`
- [ ] 2.3 In `src/lib/models.ts` or the new lib: export the taxonomy/clock types; keep zero runtime dependencies; verify with `pnpm typecheck && pnpm lint`

## 3. Scan-flow integration

- [ ] 3.1 In `src/ASF-STM.ts` `fetchInventory`: consult the error classifier on the page-loop failures (HTTP status/JSON errors) and the breaker around new page requests so a rate-limit window fails fast with a retryable error instead of aborting the run silently; verify with `pnpm typecheck` and a read-through of the loop paths (success, HTTP error, superseded run)
- [ ] 3.2 In `src/ASF-STM.ts` badge-detail stage (`GetOwnCards`) and bot badge fetch (`GetCards`): classify XHR failures (status + response text) to decide retry vs. hard abort per the existing budget rules, and gate new launches behind the breaker; keep per-badge settle semantics and `retryDelay()` as the only delay formula; verify with `pnpm typecheck` and `pnpm test` (helper suites) plus a read-through of worker lifecycle (launch/settle/abort/retry)
- [ ] 3.3 Verify spec-level leftovers of the migration are complete: `badges` progress radial (model, initializer, reset, template), slot-based bot mapping in `GetCards`, and inventory-mode candidate discovery issuing no badge-page/detail requests during eligibility; verify with `pnpm typecheck` and a grep confirming no badge-page discovery requests remain on the inventory path

## 4. Gates, docs, and release

- [ ] 4.1 Run the full gate set (`pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm build`); verify `dist/ASF-STM.user.js` builds with no unreplaced placeholders and no `// DEBUG` markers
- [ ] 4.2 Update `README.md` (inventory scan as default: paged fetch, badges database, bounded-concurrency detail stage, resilience behavior) and `AGENTS.md` (layout mention of `src/lib/resilience.ts`, owned+tradable counting) per the docs-sync rule; verify no stale scan-flow statements remain
- [ ] 4.3 Bump the package version in `package.json` (patch minimum) per the versioning rule; verify the header version in a fresh `pnpm build` output matches
