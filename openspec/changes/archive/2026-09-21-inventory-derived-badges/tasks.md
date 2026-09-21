# Tasks

## 1. Inventory counting (owned + tradable)

- [x] 1.1 In `src/lib/tradable.ts`: replace `buildTradableCardCounts` with `buildInventoryCardCounts`, a counting pass that returns, per appId per `market_hash_name`, both the owned count (all assets) and the tradable count (currently tradable assets); keep the foil/`cardborder_0`, `market_fee_app`, and fail-open tradability rules; verify with new `test/tradable.test.ts` fixtures (tradable-only, held-inclusive, mixed) and `pnpm test`
- [x] 1.2 In `src/lib/tradable.ts`: move `buildScanEligibility` to the owned-based hybrid rule (unbalanced by owned distribution with missing-cards-as-zero, AND at least one card with `tradable > 0`); update `test/tradable.test.ts` eligibility fixtures (single tradable duplicate + held copies stays eligible; all-held stays excluded; owned-unbalanced all-tradable included); verify with `pnpm test`
- [x] 1.3 Remove the superseded `resolveOwnedCount`/`resolveTradableCount` helpers and `buildTradableCardCounts`, update `src/lib/models.ts` (counting types; keep the `badges` radial and Steam description shape) and their tests; verify with `pnpm typecheck && pnpm lint`

## 2. Parallel badge-detail crawl

- [x] 2.1 In `src/ASF-STM.ts`: rework `GetOwnCards` into a bounded-concurrency detail fetcher - a fixed pool (6) of workers over a shared cursor, each next launch separated by the web limiter, per-badge retry within the global error budget, hard aborts draining in-flight workers, and invalid badges marked in a set and filtered once every badge has settled; card filling (slots, hashes, owned counts, `tradableCount` lookups) identical to the serial crawl; verify with `pnpm typecheck`
- [x] 2.2 Restore the slot-based bot mapping in `GetCards` and the `badges` progress radial (model, initializer, reset, template) that the abandoned derivation approach touched; verify with `pnpm typecheck` and a grep confirming no derivation/badge-API-removal leftovers
- [x] 2.3 Verify the concurrent detail stage on fixtures/logic review: per-badge settle semantics, invalid filtering, retry and abort paths match the serial crawl's outcomes; verify with `pnpm test` (eligibility/counting suites) and a read-through of the worker lifecycle

## 3. Gates, docs, and release

- [x] 3.1 Run the full gate set (`pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm build`); verify `dist/ASF-STM.user.js` builds with no unreplaced placeholders and no `// DEBUG` markers
- [x] 3.2 Update `README.md` and `AGENTS.md` where the scan flow or speed characteristics are described (parallel badge-detail stage; owned+tradable counting) per the docs-sync rule; verify no stale statements remain
- [x] 3.3 Bump the package version in `package.json` (patch minimum) per the versioning rule
