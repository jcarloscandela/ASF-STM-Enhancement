# Proposal

## Why

The inventory-mode scan is now the working default: the `inventory-derived-badges` change landed and was archived (owned+tradable counting, owned-based eligibility, bounded-concurrency badge-detail stage; all gates green). What remains exposed is request resilience: the scan's three request flows (inventory page fetch, badge-detail crawl, bot badge fetch) have retry budgets but no error classification and no rate-limit protection — a Steam 429 window currently surfaces as a generic abort, and retries keep hitting an already-throttled endpoint. The `steam-cards-bot` repository provides proven, directly portable pure-logic patterns (error classification, circuit-breaker backoff) that fit the userscript's request layer. The paged inventory fetch — the core of the default scanner method — is also unpinned at spec level.

## What Changes

- **New `scan-resilience` capability**: a pure error classifier (rate-limited / auth / transient / unknown taxonomy from status + error text) and a circuit-breaker state machine (consecutive rate-limited failures open an exponentially growing, capped cooldown; success resets; open breaker fails fast with a retryable error), layered on top of — not replacing — the shared retry-delay computation.
- **Integrate resilience into the scan flows**: `fetchInventory` page loop, `GetOwnCards` badge-detail workers, and `GetCards` bot fetches classify failures to decide retry vs. hard abort per the existing budget rules, and gate new request launches behind the breaker.
- **Pin the paged inventory fetch contract**: the default-path fetch pages until exhaustion (`start_assetid` pagination, paced by the inventory scan delay) so cards on later pages are counted; add the missing spec requirement.
- Docs and version: `README.md`/`AGENTS.md` describe the resilience layer (docs-sync rule); package version bump per the versioning rule.

## Capabilities

### New Capabilities

- `scan-resilience`: reusable request-resilience behavior for the scan flows — error classification of Steam failures and a circuit-breaker/backoff policy that fails fast during a rate-limit window and recovers automatically, composed with the shared retry-delay computation.

### Modified Capabilities

- `tradable-card-filter`: adds a requirement pinning the default inventory fetch's pagination contract (page until exhaustion, pacing between pages, termination on the final page). No existing requirement text changes.

## Impact

- `src/lib/resilience.ts` (new) — classifier + breaker as pure helpers, zero runtime dependencies.
- `src/ASF-STM.ts` — integration points only: `fetchInventory`, `GetOwnCards`, `GetCards`.
- `test/resilience.test.ts` (new) — fixture coverage for the classifier and breaker, following the existing lib-test pattern.
- `openspec/specs/tradable-card-filter/spec.md` — gains the pagination requirement on archive.
- Docs: `README.md`, `AGENTS.md`; version bump in `package.json`.
