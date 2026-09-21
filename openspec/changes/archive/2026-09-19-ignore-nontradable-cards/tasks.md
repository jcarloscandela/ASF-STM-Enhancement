## 1. Tradability helpers

- [x] 1.1 Add a helper that classifies an inventory description as tradable using only the `tradable` flag (false/0/"0" is non-tradable; missing is tradable). `market_tradable_restriction` must not be used — it is the post-market cooldown period present even on tradable items. Verify by inspecting the helper and logging a few sample descriptions in the debug build.
- [x] 1.2 Add a helper that builds `{ [appId]: { [market_hash_name]: tradableCount } }` from the paged inventory response, including only `item_class_2` + `cardborder_0` descriptions and only assets whose `classid` + `instanceid` resolve to an included description. Verify with a console check that a known held card is absent and a known tradable card is present.

## 2. Inventory response retention

- [x] 2.1 Ensure `fetchInventory()` continues to return all `item_class_2` descriptions and all assets with the tradability fields intact, so both the badge-selection logic and the tradability helper can consume the same response. Verify the returned object shape in the debug console.

## 3. Inventory scan path

- [x] 3.1 Update `getBadgesInventory()` to build badge eligibility from the tradable-card counts instead of all assets, preserving the existing `item_class_2` and `cardborder_0` filters. Verify that a badge whose only duplicates are trade-held is not added to `myBadges`.

## 4. Legacy badge-page path and scan filters

- [x] 4.1 Reset the module-level tradability map at the start of each scan in `buttonPressedEvent()`. Verify the map is empty immediately after pressing the scan button.
- [x] 4.2 Fetch the inventory once and build the tradability map before the legacy `getBadges()` flow and before `processFilters()` can call `GetOwnCards()`, in both the inventory-scan-disabled and scan-filter cases. Verify via debug logs that the map is ready before the first own-card count is applied.

## 5. Match counts

- [x] 5.1 Update `GetOwnCards()` to set each card's `count` from the tradability map when the map has an entry for that appId (missing card hash means 0), and to fall back to `ajaxgetbadgeinfo` `owned` when the map is unavailable or the appId is absent. Verify that a badge with only trade-held duplicates is dropped by the existing "no duplicates" filter.

## 6. Build and verification

- [x] 6.1 Run `python script/build.py` and confirm both `dist/ASF-STM.user.js` and `dist/ASF-STM.debug.js` are regenerated without errors.
- [x] 6.2 Confirm both generated artifacts contain the tradability logic and that the debug artifact retains the exclusion logging. Verify with a text search of `dist/`.
- [ ] 6.3 Perform a manual scan on a badges page with at least one trade-held card and confirm the resulting matches no longer include badges that require offering held cards, and that no trade opens with an empty user side.
