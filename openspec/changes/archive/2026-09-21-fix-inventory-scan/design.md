# Design

## Context

See proposal.md for motivation. Verified findings that shape the approach:

- **The inventory migration landed**: the `inventory-derived-badges` change was implemented and archived. The default path (`resolveScanPlan` -> inventory mode) runs a paged `steamcommunity.com/inventory/{steamid}/753/6` fetch (Zod-parsed, run-id supersession guard), owned+tradable counting, owned-based eligibility over the badges database, and a bounded-concurrency (6) badge-detail stage. All gates pass (`pnpm typecheck`, 144/144 vitest cases).
- **Upstream comparison stands** (original repo, v6.0.0.12, commit `d1957a9`): the 8900% figure covers only the discovery swap; the badge-detail API is structurally required for zero-owned cards. No redesign is needed here.
- **The resilience gap**: `fetchInventory` throws on the first HTTP/JSON error and the scan aborts; the `GetOwnCards`/`GetCards` XHR flows retry within error budgets but treat every failure alike — no 429 detection, no fail-fast, so a Steam rate-limit window produces wasted retries and a generic abort.
- **steam-cards-bot** (`C:\Users\jccan\Desktop\Projects\steam-cards\steam-cards-bot`) is TypeScript with the same toolchain; two pure-logic patterns port cleanly: `steamErrorClassifier.ts` (status/message-based failure taxonomy) and `rateLimitCircuitBreaker.ts` (fail-fast cooldown with exponential backoff, success reset). Its infra (steam-user/steamcommunity/DB/API keys) does not apply to a userscript.

## Goals / Non-Goals

**Goals:**

- Harden the scan's request flows against Steam rate limiting with the ported classifier + circuit breaker, composed with the existing shared retry-delay computation.
- Pin the paged inventory fetch contract at spec level (page until exhaustion, pacing, termination).
- Keep all scan semantics: retries within the existing budgets, explicit aborts, run-id supersession, and the `request-service` guarantee of one shared delay formula.
- Update docs and version per repo rules.

**Non-Goals:**

- Removing the badge-detail API (structurally impossible — zero-owned cards; settled by the archived change).
- Matching algorithm, scan filters, settings shape, storage, or trade-offer page flow changes.
- Porting any steam-cards-bot infrastructure (DB caching, stale-serve, API keys, bot sessions) — no new runtime dependencies.

## Decisions

### D1: Resilience helpers as one new pure lib

New `src/lib/resilience.ts`, modeled on steam-cards-bot but adapted to the userscript:

- `classifySteamError(status, errorText)` -> `RateLimited | Auth | Transient | Unknown` — pure, status table + substring heuristics (429 and Steam's rate-limit body -> RateLimited; session/auth signals -> Auth; network/timeout/5xx -> Transient).
- `RateLimitCircuitBreaker` — pure state machine with an injectable clock: consecutive rate-limited failures >= threshold opens the breaker for an exponentially growing, capped cooldown; any successful request resets it; an open breaker fails fast (retryable error, no network attempt). Constants (threshold, base cooldown, cap) are documented lib-level values.
- Unit-tested directly with plain fixtures in `test/resilience.test.ts`, following the existing lib-test pattern; no DOM or network in tests.

- Alternative: inline the heuristics in `ASF-STM.ts` — rejected: untestable, duplicates classification across three flows.

### D2: Composition is one-directional — the breaker gates attempts, `retryDelay()` stays the only delay formula

`retryDelay()` (web limiter + error limiter, from `src/lib/requests.ts` usage) remains the per-retry delay. The breaker only decides whether/when a request may be attempted and resets on success. Classification decides retryability: rate-limited and transient failures retry within the existing budgets; auth and unknown hard failures abort with the existing visible errors. This preserves the `request-service` spec (one shared retry computation) while adding the gate.

- Alternative: fold backoff into the breaker — rejected: would duplicate the delay formula the request-service spec pins.

### D3: Integration points are the three existing request flows

- `fetchInventory` page loop: classify page failures (HTTP status / JSON errors); gate new page attempts behind the breaker; the run-id supersession guard keeps priority over any retry scheduling. Failure that exhausts the budget surfaces the existing explicit abort (no silent fallback).
- `GetOwnCards` badge-detail workers: classify XHR failures (status + response text) to choose retry vs. hard abort per the existing per-badge/global budget rules; launches gated by the breaker; per-badge settle semantics unchanged.
- `GetCards` bot fetches: same classification for retry vs. abort; launches gated by the breaker.
- No stale-serve path exists or is added: an open breaker surfaces a retryable error status mid-scan.

- Alternative: port steam-cards-bot's breaker wholesale with stale-serve semantics — rejected: the scanner has no cache to serve; stale-serve would violate the "no silent fallback" requirement.

### D4: Docs and version

`README.md` describes the scan's resilience behavior (classification, fail-fast, automatic recovery) alongside the existing scan-flow description; `AGENTS.md` layout mentions `src/lib/resilience.ts`. Package version bump (patch minimum from the current `package.json` value) per the versioning rule; the build injects it into the userscript header.

## Risks / Trade-offs

- [Breaker could mask a scan behind long cooldowns] -> Cooldown cap plus fail-fast with a retryable status; the user can stop/retry manually; defaults kept at steam-cards-bot-proven values.
- [Breaker + retry-delay could double-penalize] -> One-directional composition (D2); combined semantics covered by unit tests.
- [XHR flows are DOM-coupled and hard to test] -> All decisions live in the pure lib (fixtures-tested); integration is verified by the gates plus a read-through of launch/settle/abort/retry paths.
- [Classifier misbuckets a failure as retryable] -> Existing error budgets still bound retries and the abort path remains; worst case is the pre-change behavior.

## Migration Plan

1. Land the resilience lib + tests in one commit; verify gates.
2. Land scan-flow integration; verify gates + build.
3. Docs + version bump. Rollback = revert the commits; the scan flows return to their current behavior.

## Open Questions

None. The baseline is green, the portability of the two patterns is verified, and the scope is bounded to them plus the pagination pin.
