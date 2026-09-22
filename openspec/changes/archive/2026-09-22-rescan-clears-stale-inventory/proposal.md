# Proposal

## Why

After completing trades, the user's Stop → rescan workflow reuses the bot listing cached in memory and `localStorage` (`TempAsfStm.ASF.STM.BotCache`, 5-minute TTL), so matches are computed against bot inventories from before the trades — producing exactly the reported "theirs: … (not in inventory)" offer failure. Stop currently only flips the `stop` flag and clears the resume record; nothing invalidates the stale bot data.

## What Changes

- The Stop button invalidates the bot cache (in-memory `bots` plus the persisted BotCache entry), so the next scan refetches the bot listing with post-trade inventories instead of reusing a stale snapshot.
- Own inventory needs no change: it is fetched fresh from Steam on every scan (`fetchInventory`); a "yours: … (not in inventory)" shortfall means the card left the account between scan and offer, which the named-cards dialog already reports.
- Learned card metadata (`BadgeCards` cache) and settings/blacklist are left untouched — they carry no counts and going stale is harmless.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `scan-lifecycle`: Stop semantics gain bot-cache invalidation (observable: post-Stop rescan refetches bots).

## Impact

- `src/ASF-STM.ts` (`stopButtonEvent`/`stopEventCleanup`, bot-cache read path), `test/` coverage for Stop-then-rescan refetch behavior.
- One extra ASF `Api/Listing/Bots` (or friends-list) fetch per post-Stop rescan; no storage-schema or settings changes.
