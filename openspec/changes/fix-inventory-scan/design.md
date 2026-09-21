# Design

## Context

See proposal.md for motivation. Verified findings that shape the approach:

- **Upstream reference** (`C:\Users\jccan\Desktop\Projects\ASF-STM-Enhancement`, v6.0.0.12, commit `d1957a9`): the "efficient inventory fetching" is `fetchInventory()` paging `https://steamcommunity.com/inventory/{steamid}/753/6?l=english&count=2000` with `start_assetid`/`more_items`, filtering `item_class_2` + `cardborder_0` descriptions, and mapping classids onto the `nolddor/steam-badges-db` database for eligibility. Upstream still calls `GetOwnCards` (`ajaxgetbadgeinfo`) for per-badge card details - the inventory cannot describe zero-owned cards, so the badge-detail API is structurally required. The 8900% figure covers only the discovery swap.
- **This repo's default path already routes to inventory mode** (`resolveScanPlan` in `src/lib/settings.ts` - inventory is the unconditional default when scan filters don't take precedence), and `fetchInventory` in `src/ASF-STM.ts` mirrors upstream page-for-page (plus Zod parsing and a run-id supersession guard). The mechanism is not the problem.
- **The breakage is a half-finished migration in the working tree**: `src/lib/tradable.ts` was rewritten to `buildInventoryCardCounts` (owned+tradable per card) and owned-based `buildScanEligibility`, but `test/tradable.test.ts` still uses the old `Record<string, number>` counting shape - `pnpm typecheck` fails with ~14 type errors and `pnpm test` fails 18 cases. The parallel `GetOwnCards` (6 in-flight) is in place, but spec-level leftovers (`badges` radial, slot-based bot mapping in `GetCards`) and the docs/version steps are not done.
- **steam-cards-bot** (`C:\Users\jccan\Desktop\Projects\steam-cards\steam-cards-bot`) is TypeScript with the same toolchain; its infra (steam-user/steamcommunity/DB) does not apply to a userscript, but two pure-logic patterns port cleanly: `steamErrorClassifier.ts` (message/status-based failure taxonomy) and `rateLimitCircuitBreaker.ts` (fail-fast cooldown with exponential backoff, success reset).

## Goals / Non-Goals

**Goals:**

- Make the default inventory scan complete end-to-end again: gates green (`typecheck`, `lint`, `format:check`, `test`, `build`), owned+tradable counting aligned with its tests, eligibility on the owned-distribution rule with a tradable-presence gate.
- Keep upstream-compatible scan semantics: paged inventory fetch, badges-database eligibility, badge-detail stage with bounded concurrency and identical results to the serial crawl.
- Harden the scan against Steam rate limiting with the ported classifier + circuit breaker, composed with the existing shared retry-delay computation.
- Update docs and version per repo rules.

**Non-Goals:**

- Removing the badge-detail API (structurally impossible - zero-owned cards; matches the active `inventory-derived-badges` change's investigation).
- Matching algorithm changes, scan filters, settings shape, storage, or trade-offer page flow changes.
- Porting any steam-cards-bot infrastructure (DB caching, API keys, bot sessions) - no new runtime dependencies.

## Decisions

### D1: Finish the in-tree migration instead of reverting

The working tree already contains most of the change (counting pass, eligibility rule, parallel detail stage). Reverting to 1.0.11 would discard correct work and reintroduce the tradable-only junk-candidate behavior; finishing it is smaller and lower-risk. The port keeps its improvements over upstream (Zod-validated payloads, run-id supersession, fail-open tradability with hold-date parsing) - upstream is the reference for behavior, not a byte-for-byte target.

- Alternative: revert and re-apply upstream's approach verbatim - rejected: loses already-verified hardening and still needs the same counting/eligibility rework.

### D2: Owned+tradable counting pass stays; tests move to it

`buildInventoryCardCounts` returns `InventoryCardData { owned, tradable }` per appId per `market_hash_name` (regular cards only, `market_fee_app` as the game id, fail-open tradability). `test/tradable.test.ts` fixtures are rewritten to this shape: counting fixtures (tradable-only, held-inclusive, mixed) and eligibility fixtures pinning the four spec scenarios (owned-unbalanced + tradable duplicate scanned; all-held excluded; owned-balanced excluded; dual-count reported). Upstream's missing-card rule (`size < max_size`) is kept without the `min > 0` precondition, matching the drafted `buildScanEligibility` and the spec delta.

- Alternative: keep tradable-only counting and only fix tests - rejected: the owned-based rule is what upstream's eligibility math actually computes (it counts all assets) and removes tradable-only junk candidates.

### D3: Resilience helpers as a new pure lib, composed with the retry policy

New `src/lib/resilience.ts`, modeled on steam-cards-bot but adapted to the userscript:

- `classifySteamError(status, errorText)` -> `RateLimited | Auth | Transient | Unknown` (pure, table + substring heuristics incl. 429 and Steam's rate-limit body).
- A `RateLimitCircuitBreaker` (pure state machine, injectable clock): consecutive rate-limited failures >= threshold opens the breaker for an exponentially growing cooldown (base minutes, capped), any successful request resets it; open breaker = fail fast, surfacing the retryable error status. No stale-cache serving (userscript has none to serve; the scan aborts with a retryable error instead).
- Integration points: `fetchInventory` (the `fetch` loop) and the badge-detail/`GetCards` XHR flows consult the classifier to decide retryability, and the breaker gates new request launches. The existing `retryDelay()` formula (web limiter + error limiter) remains the per-retry delay - the breaker only decides whether/when a request may be attempted. This preserves the `request-service` spec (one shared retry computation) while adding the gate.
- DOM-coupled flows (XHR handlers in `ASF-STM.ts`) get the logic via the pure helpers; the vitest suite covers the helpers directly with plain fixtures (`test/resilience.test.ts`), following the existing lib-test pattern.

- Alternative: inline the heuristics in `ASF-STM.ts` - rejected: untestable, duplicates error classification in three flows.
- Alternative: port steam-cards-bot's breaker wholesale with stale-serve semantics - rejected: the scanner has no cache to serve; stale-serve would violate the "no silent fallback" requirement.

### D4: Badge-detail stage stays at fixed concurrency 6 with per-badge settle semantics

The drafted `GetOwnCards` pool (cursor + settle counting, invalid badges marked then filtered, abort checks at launch/settle, per-badge retry within the global error budget scaled by concurrency) is kept as-is; the remaining work is completing the spec-level leftovers it superseded: the `badges` progress radial model/initializer/reset and the slot-based bot mapping in `GetCards` if the drafted code regressed them, plus code-review verification of the worker lifecycle (2.x of the sibling change).

- Alternative: re-verify serial crawl first, then re-apply - rejected: the parallel implementation is complete on inspection; re-doing it adds risk without new information.

### D5: Docs describe the inventory-default scan accurately

`README.md` gets a "Inventory scan (default)" feature line with the real characteristics (paged fetch, badges database, bounded-concurrency detail stage, resilience) and the upstream changelog footnote reference; `AGENTS.md` overview/layout mention `src/lib/resilience.ts` and the owned+tradable counting. Version bump patch-minimum in `package.json` (single version source; build injects it).

## Risks / Trade-offs

- [Owned-based eligibility changes which badges are scanned] -> Intended behavior per spec; the four pinned scenarios are covered by fixtures before anything else lands.
- [Circuit breaker could mask a scan behind long cooldowns] -> Cooldown cap and fail-fast surface a retryable status; the user can stop/retry manually; threshold kept at steam-cards-bot-proven defaults (documented constants in the lib).
- [Breaker + retry-delay interaction could double-penalize] -> Composition is one-directional: `retryDelay()` computes the delay; the breaker only gates attempts and resets on success; covered by unit tests for the combined semantics.
- [Working tree carries unrelated uncommitted edits] -> Apply starts from the current tree state and completes it; gates are the arbiter (all five must pass before commit).

## Migration Plan

1. Land lib changes (counting/test alignment, resilience lib + tests) in one commit; verify gates.
2. Land scan-flow integration (breaker/classifier into `fetchInventory` + detail flows) and any radial/bot-mapping leftovers; verify gates + build.
3. Docs + version bump; `dist/` stays gitignored and CI-built; rollback = revert the commits (serial/1.0.11 behavior returns).

## Open Questions

None. The upstream mechanism is verified, the counting/eligibility target is pinned by the spec delta, and the resilience scope is bounded to the two ported patterns.
