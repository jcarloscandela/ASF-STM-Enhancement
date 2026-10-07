# Design

## Context

See proposal.md (Why). Current state: `blacklist: string[]` persisted via `STORAGE_KEYS.blacklist` (`src/lib/storage.ts:19`); auto-blacklist site in `src/ASF-STM.ts:1052-1063` pushes the SteamID and calls `SaveConfig()`; future scans skip at `src/ASF-STM.ts:998-1003` before any fetch. At the capture site the full `BotEntry` (`Nickname`, `AvatarHash`, `TotalInventoryCount`) is already in memory (`bots.Result[userindex]`), so no fetch is needed for fresh entries. Config dialog tabs follow the `input radio + label + div.asf_stm_content` pattern (`src/templates/configDialogTemplate.ts:37-375`, tabs 1-5; blacklist textarea is tab3). The script runs on `steamcommunity.com` with cookies available for same-origin profile fetches. Per explore decision: removal is manual-only (scan can never observe a blacklisted bot becoming public).

## Goals / Non-Goals

**Goals:**

- Zero-fetch capture on the scan hot path using the in-memory bot entry snapshot.
- Versioned, corrupt-tolerant persistence for the new metadata record.
- Tab6 UI reusing existing tab pattern and avatar-link pattern (`rowTemplate.ts`).
- `Limpiar` is atomic across both stores with immediate persist + re-render.

**Non-Goals:**

- No in-script friend-request sending (user acts manually in Steam; endpoint `AddFriendAjax`/`sessionid` handling explicitly out of scope).
- No auto-reconciliation of the private list against later scans or the friends list.
- No bulk clean-all button in v1 (per-row only; can be added later without spec change).
- No change to blacklist textarea semantics or settings merge behavior.

## Decisions

1. **Separate `privateMeta` record keyed by SteamID, blacklist stays `string[]`.**
   Rationale: keeps the existing skip filter and textarea format untouched (no migration of user-edited text); metadata is display-only enrichment. Alternative (single rich blacklist array) rejected: would force textarea format change and risk breaking user edits.
   Shape: `Record<SteamID64, { nickname: string | null; avatarHash: string | null; totalItems: number | null; firstSeen: number; lastSeen: number }>` under `STORAGE_KEYS.privateBots = "TempAsfStm.ASF.STM.PrivateBots.v1"`. New lib `src/lib/private-bots.ts` with pure helpers (`upsertPrivateBot`, `removePrivateBot`, `readPrivateBots`, `writePrivateBots`, `needsBackfill`) operating on an injected storage-like interface, mirroring `storage.ts` testability rule.
2. **Capture at the existing auto-blacklist site, friend-mode excluded.**
   `GetCards` private branch calls `upsertPrivateBot(store, entry snapshot, Date.now())` only when `!globalSettings.matchFriends`. Friend-mode private entries (friends-only badges) are not recorded: the tab is defined as non-friend bots the user may want to befriend. Alternative (record both) rejected: friends are already friends; no rescue action exists.
3. **Lazy backfill on tab open, cache-first.**
   Order per unresolved entry: (a) current `bots.Result` cache, (b) same-origin `GET https://steamcommunity.com/profiles/{ID}` parsed for nickname/avatar, serially with existing `weblimiter` delay and error-budget respect; one failure never blocks other rows (row falls back to SteamID text + default avatar hash `fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb`). Alternative (backfill during scan) rejected: adds requests to the scan hot path and competes with rate limits.
4. **Tab6 rendered from `privateMeta`, rows link out.**
   `renderPrivateBotsTab(entries)` in `configDialogTemplate.ts`; avatar `<a href="https://steamcommunity.com/profiles/{ID}" target="_blank" rel="noopener noreferrer">`. `Limpiar` button per row (`data-steamid`), delegated click handler in `ASF-STM.ts` config wiring: `removePrivateBot` + `blacklist = blacklist.filter(id !== sid)` + `SaveConfig()` + re-render tab body only. Alternative (require dialog Save) rejected: user expectation is immediate removal.
5. **Orphan policy: tab shows union, `Limpiar` clears both.**
   Rows render for every `privateMeta` entry regardless of blacklist presence (covers textarea hand-edits that removed the ID early). `Limpiar` is idempotent on the blacklist side. No reverse sync (textarea edits do not touch `privateMeta`).

## Risks / Trade-offs

- [Profile fetch fragility] Steam profile HTML can change → Mitigation: backfill is best-effort with graceful fallback to SteamID text; never throws; covered by keeping parser minimal (avatar `og:image`, title nickname) and cache-first so most rows need no fetch.
- [Duplicate/large lists] Hundreds of private bots bloat localStorage → Mitigation: compact per-entry shape (short keys at JSON level acceptable inside lib), no polling; tab renders rows lazily if needed. No pagination in v1; revisit if lists exceed ~500.
- [Stale display data] Nickname/avatar frozen at capture → Mitigation: backfill only fills missing data, never overwrites known-good snapshot except `lastSeen`/`totalItems` refresh on re-capture; acceptable because the row's job is identification + profile link, not live presence.
- [Textarea divergence] User edits blacklist text directly, leaving `privateMeta` orphans → Mitigation: documented orphan policy above; tab remains the canonical remover.

## Migration Plan

- Additive only: new storage key, new lib, new tab. No existing key format changes, no settings reset.
- Corrupt/version-mismatched `privateMeta` → empty list, scan and dialog continue normally.
- Rollback: delete the new key and the tab; blacklist behavior is unchanged.
- Version bump per AGENTS.md MUST rules (patch minimum) + docs-sync (`AGENTS.md`/`README.md`) at implementation time.

## Open Questions

None. Friend-request automation, bulk-clean, and auto-reconciliation are deferred non-goals, not unknowns.
