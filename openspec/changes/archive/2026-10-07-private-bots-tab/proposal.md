# Proposal

## Why

Bots with private profiles are auto-blacklisted during the scan (`blacklist.push` when a gamecards page has no card section). The blacklist only stores SteamIDs, so users cannot see who those bots are, visit their Steam profile to send a friend request manually, or remove them without editing a raw textarea. A dedicated rescue list makes private bots actionable instead of invisible.

## What Changes

- Record private-inventory partners at auto-blacklist time as rich metadata (SteamID + nickname, avatar hash, inventory count, first/last seen) in browser localStorage under a new versioned key.
- Backfill display data for legacy IDs (blacklisted before this feature, or rotated out of the ASF list) lazily when the config tab opens, reusing data already in the bot cache first and fetching the Steam profile only when needed.
- Add a new `Private bots` tab (tab6) to the config dialog listing non-friend private-inventory entries: avatar image linking to `https://steamcommunity.com/profiles/{SteamID}`, nickname, item count, and a per-row `Limpiar` button.
- `Limpiar` removes the entry from the private list AND from the `blacklist` when present, then persists and re-renders. No automatic cleanup: blacklisted bots are skipped before any inventory fetch, so the scan can never observe them becoming public again.

## Capabilities

### New Capabilities

- `private-bots`: rescue list for non-friend private-inventory partners — capture, persistence, config-tab display with profile links, and manual-only removal that also un-blacklists.

### Modified Capabilities

None. Existing blacklist skip behavior, settings merge, and storage-helper contracts are unchanged; the new key follows the existing storage-service key-inventory rule.

## Impact

- New lib `src/lib/private-bots.ts` (types, record read/write, upsert/remove, legacy backfill helpers) + new `STORAGE_KEYS` entry in `src/lib/storage.ts`.
- `src/ASF-STM.ts` host wiring: capture snapshot at the existing auto-blacklist site, load metadata on config open, render/click handlers for the new tab.
- `src/templates/configDialogTemplate.ts`: new tab6 markup + row renderer.
- Tests: pure unit tests for the new lib (no DOM/network); DOM wiring covered by existing happy-dom harness patterns if cheap, otherwise not.
