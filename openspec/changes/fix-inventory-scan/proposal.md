# Proposal

## Why

The default inventory scan path (the port of upstream v6.0.0.12's "efficient inventory fetching, up to 8900% faster") is currently broken in this repo: the working tree holds a half-finished migration with failing gates (`pnpm typecheck` errors in `test/tradable.test.ts`, 18 failing vitest cases, no buildable bundle). Upstream comparison (commit `d1957a9` of the original repo) confirms the mechanism itself is correct — a paged `steamcommunity.com/inventory/{steamid}/753/6` fetch feeding badge eligibility from the badges database — so the fix is to finish the port coherently, not to redesign it. Additionally, the upstream scan still lacks resilient request handling: its inventory fetch and badge-detail crawl have no error classification or backoff, so transient Steam rate-limiting can fail a scan that could recover. The `steam-cards-bot` repository already provides proven pure-logic patterns (error classification, circuit-breaker backoff) that fit the userscript's request layer.

## What Changes

- **Finish the owned+tradable inventory counting pass** (`buildInventoryCardCounts` in `src/lib/tradable.ts`): per card, count both owned copies (held included) and currently tradable copies; align `test/tradable.test.ts` fixtures with the new `InventoryCardData` shape so `pnpm typecheck` and `pnpm test` pass.
- **Align badge eligibility with the owned-based hybrid rule**: eligibility from the owned-copy distribution (missing cards count as zero) gated on at least one currently tradable copy; update the pinned eligibility scenarios in the spec delta accordingly.
- **Verify the default inventory scan end-to-end**: inventory mode remains the unconditional default (`resolveScanPlan`), the fetch pages with `start_assetid` + `inventoryScanDelay`, the badges database drives candidate discovery, and the parallel badge-detail stage (already implemented) settles before bot matching; failure of any prerequisite aborts explicitly rather than degrading.
- **Adopt steam-cards-bot request-resilience patterns** as pure helpers: an error classifier (rate-limited / auth / transient taxonomy) and an exponential-backoff circuit-breaker for the inventory fetch and badge-detail requests, integrated with the existing shared retry-delay computation instead of replacing it.
- Docs and version: `README.md`/`AGENTS.md` scan-flow description refreshed (docs-sync rule) and a package version bump (versioning rule).

## Capabilities

### New Capabilities

- `scan-resilience`: reusable request-resilience behavior for the scan flows — error classification of Steam failures (rate-limited, auth, transient, unknown) and a circuit-breaker/backoff policy that fails fast during a rate-limit window and recovers automatically, layered on top of the shared retry-delay computation.

### Modified Capabilities

- `trade-matching`: the inventory-mode eligibility requirement changes from a tradable-only rule to an owned-copy-distribution rule with a tradable-presence gate; counting must return owned and tradable copies per card; the parallel badge-detail stage keeps per-badge semantics.
- `tradable-card-filter`: the first-scan-completion requirement gains explicit coverage for the inventory-mode default path (pacing, pagination, badges-database dependency, explicit abort on failure).

## Impact

- `src/lib/tradable.ts` — owned+tradable counting pass; owned-based eligibility (already drafted, needs test alignment).
- `src/lib/models.ts` — `InventoryCardData`/`InventoryCardCounts` types (drafted).
- `src/ASF-STM.ts` — inventory fetch, parallel `GetOwnCards` detail stage, and integration of the resilience helpers into the scan flows.
- `src/lib/` (new helper, e.g. `resilience.ts`) — error classification and backoff/circuit-breaker logic, unit-tested with plain fixtures.
- `test/tradable.test.ts` + a new `test/resilience.test.ts` — fixture updates and new coverage; gates (`typecheck`, `lint`, `format:check`, `test`, `build`) must pass.
- Docs: `README.md`, `AGENTS.md`; version bump in `package.json`.
