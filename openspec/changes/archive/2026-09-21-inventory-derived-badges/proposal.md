# Proposal

## Why

After `inventory-only-counting` the scan discovers badges from the Steam inventory API (the port of upstream 6.0.0.12's "efficient inventory fetching"), but the scan still crawls the badge detail API (`ajaxgetbadgeinfo`) once per candidate badge in `GetOwnCards` - one request at a time with a 300 ms web-limiter gap between requests. On accounts with many crafted badges that stage dominates the scan (watched on the "badges" progress radial), so the inventory default does not deliver the promised speed. Upstream 6.0.0.12 kept the same serial crawl (its 8900% figure covers only the discovery swap), so the detail stage is the remaining shared bottleneck - and the badge-detail API cannot simply be deleted: its `rgCards` payload is the only source for the full per-set slot list (canonical order, market hashes, and zero-owned cards) that the receive side of matching requires. Investigation during planning/apply confirmed that deriving card data purely from the inventory is impossible for zero-owned cards.

## What Changes

- **Parallelize the badge-detail crawl**: `GetOwnCards` fetches candidate badges with bounded concurrency - up to 6 `ajaxgetbadgeinfo` requests in flight at once, each next request launched after the web-limiter delay - instead of one request per 300 ms serially. Roughly 5-8x faster on badge-heavy accounts, with identical results.
- The parallel crawl keeps all per-badge semantics: retries within the global error budget, hard aborts on non-retryable failures, and invalid badges (single-key responses) marked during the crawl and filtered once every request has settled, so concurrent workers never reorder the badge list under each other.
- Inventory counting returns **both** owned and currently tradable copies per card (today only tradable copies are counted and held copies are dropped), letting badge eligibility run on the **owned-copy** distribution with an "at least one tradable copy" gate - removing junk candidates the tradable-only rule produces on badge-heavy accounts while keeping every existing eligibility guarantee.
- Matching, tradability rules, owned-vs-tradable semantics (owned counts still come from the badge-detail API), slot-based bot mapping, scan filters, settings, and the trade-offer page flow are unchanged.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `trade-matching`: the inventory-mode eligibility requirement changes from a tradable-copy-based rule to an owned-copy-based rule with a tradable-presence gate; a new requirement pins the bounded-concurrency detail stage (parallel in-flight requests, rate-limited launches, per-badge retry, identical results).

## Impact

- `src/lib/tradable.ts` - counting pass returns owned + tradable copies per card; `buildScanEligibility` moves to the owned-based hybrid rule; the tradable-only lookup helpers become unnecessary.
- `src/lib/models.ts` - eligibility entry data and the counting-pass result types; no matcher shape changes.
- `src/ASF-STM.ts` - `GetOwnCards` becomes a bounded-concurrency detail fetcher; `getBadgesInventory` runs the combined counting pass; `GetCards`, bot mapping, and the trade-offer flow unchanged.
- `test/tradable.test.ts` - counting and eligibility fixtures; parallel-crawl behavior is DOM-coupled and verified via the gates plus code review.
- Docs: `README.md` / `AGENTS.md` scan description; version bump per repo rules.
