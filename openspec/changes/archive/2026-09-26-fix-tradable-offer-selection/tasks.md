# Tasks

## 1. Reproduce and diagnose

- [x] 1.1 Add failing position-variant repro tests for the 3-copy case (2 held + 1 tradable with the tradable copy at lowest, middle, and highest id) under SORT and RANDOM in `test/offer-harness.test.ts` and verify they fail before the fix via `pnpm test`.
- [x] 1.2 Capture and document the real live `rgInventory` item shape versus `SteamInventoryDescription` (top-level `market_hash_name`, `tradable` flag encoding, hold-text location and date format) and verify the finding with a pool-shape fixture test via `pnpm test`.
- [x] 1.3 Verify scan-time vs offer-time verdict parity (`isCurrentlyTradableDescription` vs `isTradeOfferItemTradable`, including `Tradable After` parsing and fail-open behavior) against the captured shape and verify with focused `tradable`/`offer-writer` tests via `pnpm test`.

## 2. Harden offer selection

- [x] 2.1 Fix `planOfferSelection` to filter to currently-tradable copies before SORT/RANDOM ordering, pick RANDOM only among tradable copies, and never move a held copy when a tradable copy of the same name exists, and verify the 1.1 repro tests pass via `pnpm test`.
- [x] 2.2 Normalize the `addCards` pool construction so the planner receives the same name/verdict fields the scan uses (resolve nested description fields when present), and verify with the 1.2 pool-shape fixture via `pnpm test`.
- [x] 2.3 Constrain `retryUnselectableCopies` wiring to skip already-consumed ids and remove all trial moves unless every occurrence resolves (zero net moves on failure), and verify with retry harness tests via `pnpm test`.

## 3. Regression and release gates

- [x] 3.1 Run the full verification suite (`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`) and verify all gates pass with no `dist/` commit.
- [x] 3.2 Run `openspec validate --change fix-tradable-offer-selection --strict` and verify the change validates with all required artifacts present.
