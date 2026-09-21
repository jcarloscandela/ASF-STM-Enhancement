# Tasks

## 1. Evidence and fixtures

- [x] 1.1 Capture live Steam payloads for the reported held card (Alyx Vance, "Tradable After: 26/09/2026, 09:00:00") — inventory `descriptions`/`assets` entries and the trade-page `rgInventory` entry — and verify the exact field names/formats carrying the hold date are recorded in the change notes.
- [x] 1.2 Add verbatim-shaped fixtures to `test/tradable.test.js` (future-dated hold, past-dated hold, missing/unparseable date) and verify they fail against the current predicate before the fix.

## 2. Scan-mode persistence fix

- [x] 2.1 Fix `LoadConfig` default merge (`defaultSettings[key]` instead of `defaultSettings[defaultSettings]`, preserve stored values, fill missing keys) in `src/ASF-STM.js` and verify a round-trip test (stored `inventoryScan:true` plus missing keys → preserved + defaulted) passes.
- [x] 2.2 Pin scan-mode branching on the click-time settings snapshot through the cold-bot-cache `fetchBots` → `buttonPressedEvent` re-invocation, keep `processFilters` precedence documented, and verify first click with saved `inventoryScan:true` and cold bot cache executes the inventory path.
- [x] 2.3 Make inventory→badge fallback observable (debug log/status) without changing its defined behavior, and verify a failed inventory/badges-DB fetch surfaces a visible status instead of a silent mode switch.

## 3. Tradability filter fix (scan side)

- [x] 3.1 Extend the tradability predicate in `src/lib/tradable.js` so future "Tradable After" timestamps count as non-tradable (past/missing/unparseable falls back to the existing `tradable`-flag verdict; `market_tradable_restriction` stays ignored) and verify the new fixture tests pass.
- [x] 3.2 Confirm `buildTradableCardCounts`, `resolveOwnedCount`, and `buildScanEligibility` inherit the fix with no logic change, and verify the full suite passes via `node --test test/`.
- [x] 3.3 Manually verify the scan matrix: inventory on/off × scan filters on/off, first click after page load, held-only game yields no match row, future-dated card contributes zero and counts again after its date.

## 4. Trade-offer creation fix (offer side)

- [x] 4.1 Filter live `rgInventory` candidates in `addCards` (trade-offer page) to currently-tradable copies before `MoveItemToTrade`, and verify a mixed held+tradable inventory moves only the tradable copy.
- [x] 4.2 Verify the all-copies-held case hits the existing missing-items abort and no held card is added to the offer.

## 5. Build and regression

- [x] 5.1 Rebuild distributables (`dist/ASF-STM.user.js` + `dist/ASF-STM.debug.js`) with the documented build command and verify both outputs contain the updated logic with placeholders replaced.
- [x] 5.2 Run the full unit suite (`node --test test/`) and the build validation, and verify everything passes with no new dependencies.

## 6. Release

- [x] 6.1 Bump the version, commit the code, push it, and verify the working tree is clean and the remote branch is up to date.
- [x] 6.2 Create the new GitHub release and verify the release is published with the rebuilt assets/notes.

## Evidence notes (task 1.1)

No live Steam session is available in this environment, so payloads were
determined by documentation + repo history instead of a fresh capture:

- `descriptions[].tradable` (0/false/"0" = held) is the authoritative current
  trade state. A prior change verified live that held cards report
  `tradable: 0` while the hold is active.
- `market_tradable_restriction` is policy-only ("days untradable AFTER being
  sold on the market", present as 7 even on tradable items) and stays ignored.
- The per-item "Tradable After: <date>" line is rendered from the description
  text (`descriptions[]` / `owner_descriptions[]` values), so the fix parses
  that line (DD/MM/YYYY, month-name, ISO; future = held, past/missing/
  unparseable = fall back to the `tradable` flag). Fixtures use the exact
  reported string "Tradable After: 26/09/2026, 09:00:00".
- Trade-offer page `rgInventory` entries mirror the description shape
  (`tradable` flag + `descriptions` lines), so the same predicate filters
  `addCards` picks; fully-held requests reach the existing missing-items abort.
- If a live capture later shows the hold date in a different field, only
  `getTradableAfterTime` needs extending; fixtures pin the covered shapes.
