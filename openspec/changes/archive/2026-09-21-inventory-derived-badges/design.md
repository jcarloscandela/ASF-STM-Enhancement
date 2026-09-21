# Design

## Context

See proposal.md for motivation. Findings from the upstream comparison (original repo, v6.0.0.12): upstream's efficient-inventory change replaced the `/badges?p=N` discovery crawl with a paged inventory fetch feeding badge eligibility from the badges database - its changelog footnote attributes the 8900% figure to that swap (30 min / 20 badge pages vs 20 s / 6 inventory requests). Upstream **kept** `GetOwnCards` and its serial per-badge `ajaxgetbadgeinfo` crawl for card details - as does our port. An apply-stage investigation ruled out removing the crawl: the inventory only describes cards the user owns at least one copy of, while matching's receive side requires the full per-set slot list (canonical order, market hashes, zero-owned cards) that only the badge-detail API provides. The remaining lever is how the crawl itself runs.

## Goals / Non-Goals

**Goals:**

- Make the badge-detail stage bounded-concurrency: up to 6 `ajaxgetbadgeinfo` requests in flight, each next launch paced by the web limiter - the stage's wall time drops to roughly a sixth on badge-heavy accounts.
- Keep all per-badge semantics: retry within the global error budget, hard abort on non-retryable failures, invalid badges filtered, and results identical to the serial crawl.
- Adopt the owned + tradable inventory counting pass and the owned-based hybrid eligibility (better candidate selection: no tradable-only junk candidates).
- Keep matching, fairness, balance, determinism, slot-based bot mapping, and the trade-offer flow unchanged.

**Non-Goals:**

- Removing the badge-detail API (investigated and rejected - see Context).
- Changes to matcher-core pairing rules, bot filtering, scan filters, settings, or storage.
- Foil support, new settings, or trade-offer page changes.

## Decisions

### D1: One counting pass returns owned AND tradable copies per card

`buildTradableCardCounts` is superseded by `buildInventoryCardCounts`: for every regular (non-foil) card description with a market hash and game app id, count **all** assets (owned) and the subset whose description is currently tradable (tradable), keyed by `market_hash_name`. Held copies stop being dropped at this stage - eligibility needs them. Tradability fails open (a description without a tradability signal counts as tradable).

- Alternative: keep the tradable-only pass - rejected: eligibility needs owned distributions to stop over- and under-reporting candidates (D3).

### D2: Eligibility becomes owned-based with a tradable-presence gate

`buildScanEligibility` flags a badge as candidate when its **owned**-copy distribution is unbalanced (same even-distribution rule, plus missing cards counting as zero with no `min > 0` precondition) **and** at least one card has `tradable > 0`. This preserves the scenarios pinned by the previous eligibility requirement (single tradable duplicate + held copies -> scanned; all-held -> excluded), removes tradable-only junk candidates, and supersedes the `fix-matcher-tradable-counts` relaxation as a separate mechanism.

- Alternative: keep tradable-based eligibility - rejected: it under-reports (owned-but-held unbalance invisible) and over-reports (tradable stray singles).

### D3: The badge-detail crawl runs with bounded concurrency

`GetOwnCards` becomes a fixed pool of `BADGE_DETAIL_CONCURRENCY = 6` workers over a shared cursor into `myBadges`:

- Each worker takes the next badge index, issues one `ajaxgetbadgeinfo` request, fills that badge's cards from `rgCards` (title, market hash, owned count, icon, slot index - identical to today) plus the per-card `tradableCount` looked up from the counting pass, and schedules its next pull after the web limiter delay.
- A worker only settles a badge on success or on an invalid-badge response (single-key payload); other failures count against the global error budget and retry the **same** badge after the shared retry delay while `errors <= maxErrors`, otherwise the scan aborts (in-flight workers check the abort flag and drain).
- Invalid badges are **marked, not spliced**, during the crawl (a `Set` of indexes); once every badge has settled, they are filtered from the list in one pass. Concurrent workers therefore never reorder `myBadges` under each other.
- The "badges" radial still fills per settled badge. The populated tail (scan-filter bookkeeping, `SaveParams`, bot stage) runs exactly once, when the last badge settles.

Result: the stage's wall time drops from `N x (latency + 300 ms)` to roughly `N/6 x (latency + 300 ms)` with the same per-request rate-limit friendliness (launches are still separated by the web limiter).

- Alternative: unbounded parallelism - rejected; hammering `steamcommunity.com` risks 429s that the old serial pacing avoided.
- Alternative: remove the crawl by deriving card data from the inventory - investigated and rejected during apply: zero-owned cards (the ones matching needs) have no inventory representation, so their hashes/slots/order are unobtainable.

### D4: The dual-count requirement keeps its badge-page owned source

Owned counts still come from the badge-detail API's `rgCards.owned`; the inventory counting pass now provides both the eligibility input and the per-card tradable lookups. The "Badge counts separate owned copies from tradable capacity" requirement keeps its meaning; only the eligibility requirement changes.

## Risks / Trade-offs

- [Higher request rate triggers 429s more often than serial scanning] -> Mitigation: launches remain separated by the web limiter, in-flight capped at 6, and the existing error limiter backs off on error streaks; the abort path stays.
- [Concurrent workers racing on shared state] -> Mitigation: a single cursor plus settle-counting; no splices during the crawl (invalid badges marked and filtered after settle); `stop`/abort checked at every launch and settle.
- [Owned-based eligibility changes which badges get scanned] -> Mitigation: intended (fewer junk candidates); the pinned scenarios are covered by tests.
- [Parallel diagnostics interleave in the debug log] -> Mitigation: cosmetic only; each log line carries its badge id.

## Migration Plan

1. Land the code change (counting pass, eligibility, parallel detail stage, tests) in one commit; bump the package version (patch minimum) per repo rules.
2. No storage or settings migration.
3. Rollback: revert the commit - the serial crawl returns unchanged.

## Open Questions

None. The receive-side hash constraint rules out badge-API removal; concurrency is the remaining lever and needs no new assumptions.
