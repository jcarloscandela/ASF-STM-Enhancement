# Design

## Context

See proposal.md Why. Scan startup (`buttonPressedEvent`, `src/ASF-STM.ts:1671`) treats the in-memory `bots` (hydrated at load from the persisted BotCache, `:1946`) as fresh for 5 minutes (`botCacheTime`, `:116`); a Stop → rescan inside that window skips `fetchBots` entirely and matches against stale bot inventories. Stop today (`stopButtonEvent`, `:1592`) only sets `stop = true`; resume-record cleanup happens later in `stopEventCleanup`. Own inventory is always refetched (`fetchInventory`, `:1240`), so only the bot side can go stale across a rescan.

## Goals / Non-Goals

**Goals:**

- Post-trade rescans match against current bot inventories.
- Minimal extra network: refetch only after an explicit Stop, never on ordinary scans.

**Non-Goals:**

- Shortening the 5-minute TTL for normal scans or friend mode.
- Clearing settings, blacklist, badge-card metadata, or Params on Stop.
- Fixing the inherent scan-to-offer race (cards traded after the scan but before opening the offer); the named-cards dialog already covers diagnosis there.

## Decisions

- **Invalidate in `stopButtonEvent` itself (set `bots = null`, remove the persisted BotCache key)** (alternative: a "dirty" flag consumed at next scan start). Rationale: the existing startup check already refetches when `bots === null`, so invalidation reuses that path with no new branching; doing it at click time also covers Stop → page-reload → scan, since the persisted entry is gone too.
- **Reuse `removeKey` from `src/lib/storage.ts`** (alternative: direct `localStorage.removeItem`). Rationale: the storage-service spec requires all removals through the helper; keeps the key inventory single-sourced.
- **Leave `stopEventCleanup` untouched** apart from what invalidation needs. Resume-record clearing stays where it is; bot invalidation is a click-time concern, not a scan-teardown concern.

## Risks / Trade-offs

- [One extra bot-list fetch per post-Stop rescan] → Mitigation: only Stop triggers it; ASF listing and friends-list fetches are already the normal cold-start cost.
- [Stop pressed accidentally loses a fresh cache] → Mitigation: refetch is automatic on next scan; worst case is one extra fetch, no data loss (settings/matches untouched).

## Migration Plan

Userscript-only change with fixture tests (Stop clears both cache layers; next scan refetches), patch version bump per repo MUST rule. Rollback: previous release asset.
