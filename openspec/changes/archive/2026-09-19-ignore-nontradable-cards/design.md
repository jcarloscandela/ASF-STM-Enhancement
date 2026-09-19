## Context

See proposal.md for motivation. Relevant current state in `src/ASF-STM.js`:

- `fetchInventory()` (≈line 1246) pages `https://steamcommunity.com/inventory/<steamid>/753/6`, keeps only descriptions tagged `item_class_2`, and returns `{ assets, descriptions }`. It discards the `tradable` field.
- `getBadgesInventory()` (≈line 1325) maps assets to app IDs by `classid`, flags a badge as unbalanced, pushes `myBadges` stubs, then calls `GetOwnCards(0)`.
- `GetOwnCards()` (≈line 694) fetches `ajaxgetbadgeinfo/<appId>` and sets each card's `count` from `rgCards[i].owned`, overwriting any inventory-derived counts.
- The trade page (`addCards`, ≈line 1887) resolves requested cards against the trade window's tradable inventory; a held card is absent, sets `failLater`, and aborts with "Items missing".

The key constraint: the per-card counts that drive matching come from `ajaxgetbadgeinfo`, which does not report tradability, so filtering the inventory asset list alone cannot fix the match counts. The legacy badge-page flow (`getBadges`, scan filters via `processFilters`) never fetches the inventory at all.

## Goals / Non-Goals

**Goals:**

- Exclude trade-held cards from badge eligibility and from the per-card counts used for matching, in both scan modes.
- Keep behavior deterministic and safe when tradability cannot be determined.
- Reuse a single inventory fetch so the fix does not add repeated requests.

**Non-Goals:**

- Changing the matching/fairness algorithm, bot selection, or trade-offer mechanics.
- Handling marketability (only tradability affects offerable cards).
- Bot-side tradability (bots do not have trade holds for these cards).
- UI changes beyond debug logging.

## Decisions

### 1. Build one tradability map per scan from the inventory response

Add a module-level `tradableCardCounts` populated by a helper that consumes the paged inventory response and returns `{ [appId]: { [marketHashName]: tradableCount } }`, including only descriptions tagged `item_class_2` and `cardborder_0` (non-foil) whose tradability is truthy.

- Assets are counted only when their `classid` + `instanceid` resolves to an included description.
- Counts are keyed by `market_hash_name` because `GetOwnCards` exposes `hash` (markethash), while the inventory exposes `market_hash_name`; keying avoids classid/instanceid ambiguity for cards.

Alternatives considered:

- *Filter `fetchInventory` assets only* — rejected: `GetOwnCards` overrides counts, so held cards would still be matched.
- *Parse "Tradable After" from badge-page HTML* — rejected: fragile and not present on all pages.
- *Use `classid` as the key* — rejected: `GetOwnCards` has no classid, and card classid handling already drops to market hash.

### 2. Fetch the inventory once at scan start for both modes

Sequence both flows so the tradability map is ready before any `GetOwnCards` call:

- Inventory scan: `fetchInventory()` result feeds both the map and the existing `getBadgesInventory()` eligibility logic (no extra request).
- Legacy badge-page scan and scan-filter path: fetch the inventory once, build the map, then continue into `getBadges()` / `processFilters()`.

`processFilters()` currently calls `GetOwnCards` directly, so the fetch must happen before it is invoked.

### 3. Override `GetOwnCards` counts when the map is available

When `tradableCardCounts` is populated for a badge's appId, set each card's `count` from the map (missing key means 0), instead of `rgCards[i].owned`. When the map is unavailable (fetch failed) or has no entry for the appId, fall back to `owned`. This keeps badge page and inventory scan counts consistent and lets the existing "no duplicates" filter (≈line 843) drop fully-held badges.

### 4. Treat unknown tradability as tradable, and trust only `tradable`

A card is non-tradable only when the response reports `tradable` as false/0/"0". Missing/ambiguous values count as tradable. This preserves current behavior on unexpected API shapes rather than silently dropping cards.

`market_tradable_restriction` MUST NOT be used as a tradability signal. Verified against a live Steam inventory (`753/6`): every item reported `tradable: 1` together with `market_tradable_restriction: 7`, and per Steam docs that field is only the fixed post-market cooldown period, not the item's current state. Using it marked every card non-tradable and produced "No badges to match".

### 4a. Selecting the tradability signal (correction)

Detection is based solely on the description-level `tradable` flag. Trade-held cards are those Steam reports as `tradable: 0` while their hold is active.

### 5. Preserve existing card filters

Keep the `item_class_2` and `cardborder_0` filters so foils and non-card items remain excluded from the tradability map, matching current eligibility behavior.

## Risks / Trade-offs

- [Steam merges tradable and held copies under one description] → Counts may undercount tradable copies (conservative: may skip a valid match) rather than overcount. Mitigation: log excluded counts in the debug build so the assumption can be validated against real data; keying by market hash keeps it correct whenever Steam emits distinct descriptions.
- [Same `market_hash_name` used across appIds] → Map is namespaced per appId, so counts cannot leak between badges.
- [Extra inventory request on the legacy path] → One fetch of a few requests; `inventoryScanDelay` throttling is reused, and the same response is reused by the inventory-scan path.
- [`GetOwnCards` running before the map is ready] → Sequence the fetch ahead of `GetOwnCards`/`processFilters` and reset the map at scan start so stale data from a prior scan is never used.
- [Fetch failure hides valid matches] → Fall back to `owned` counts, as specified.

## Migration Plan

No data or config migration. Change is contained to `src/ASF-STM.js`; the build script regenerates both `ASF-STM.user.js` and `ASF-STM.debug.js` from source. Rollback is reverting the source file.

## Open Questions

- Whether to expose the number of excluded held cards in the UI (beyond debug logs) can be decided during implementation without affecting the specs or task breakdown.
- Whether a user setting to disable held-card filtering is wanted; default behavior (filtering on) is specified and does not depend on this.
