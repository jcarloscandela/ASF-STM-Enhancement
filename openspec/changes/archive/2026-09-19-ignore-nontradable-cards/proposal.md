## Why

The scanner counts trade-held (non-tradable) cards as if they were available, so it reports badge matches it cannot actually execute. When a trade is created the held cards cannot be added, leaving one side of the offer empty and failing the trade. Both release builds (`ASF-STM.user.js` and `ASF-STM.debug.js`) are affected because both come from the same source.

## What Changes

- Detect tradability from the Steam inventory response and exclude trade-held cards from all matching decisions.
- Inventory scan path (`inventoryScan`): only tradable cards contribute to badge eligibility and per-card match counts.
- Legacy badge-page scan path (`getBadges` / scan filters): apply the same tradability data (fetched once per scan) so held cards are excluded there too.
- When tradability data cannot be fetched, fall back to the current behavior instead of dropping cards.
- Debug builds log how many held cards were excluded for troubleshooting.

## Capabilities

### New Capabilities

- `trade-matching`: How the scanner determines which of the user's owned cards are eligible to be matched and offered in a trade, including the requirement to ignore non-tradable (trade-held) cards.

### Modified Capabilities

<!-- None: no main specs exist yet. -->

## Impact

- `src/ASF-STM.js`: `fetchInventory()`, `getBadgesInventory()`, `GetOwnCards()`, `buttonPressedEvent()`, and the legacy `getBadges()` entry flow; new helper for building tradable counts.
- No changes to `script/build.py` or the release workflow; both generated artifacts pick up the fix.
- Adds one Steam inventory request to the legacy scan path when it is not already fetched.
