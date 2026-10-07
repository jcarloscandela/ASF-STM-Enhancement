// Private-bots rescue list: metadata for non-friend partners whose badge
// pages had no card section (private profile / friends-only badges) at
// auto-blacklist time.
//
// The scan skips blacklisted partners before any fetch, so it can never
// observe them becoming public again: removal is manual-only via the
// config "Private bots" tab. This module is pure (no DOM, no network):
// callers pass a `StorageLike`, the userscript passes real `localStorage`
// while tests pass an in-memory fake.

import type { BotEntry } from "./models";
import { readJson, STORAGE_KEYS, writeJson, type StorageLike } from "./storage";

/** Display metadata for one private partner, keyed by SteamID64. */
export interface PrivateBotEntry {
  steamId: string;
  nickname: string | null;
  avatarHash: string | null;
  totalItems: number | null;
  firstSeen: number;
  lastSeen: number;
}

/** Persisted shape: SteamID64 -> entry. */
export type PrivateBotRecord = Record<string, PrivateBotEntry>;

/** Display snapshot available at capture time (subset of BotEntry). */
export interface PrivateBotSnapshot {
  SteamID: string;
  Nickname?: string | null;
  AvatarHash?: string | null;
  TotalInventoryCount?: number | null;
}

function isValidEntry(value: unknown): value is PrivateBotEntry {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v["steamId"] === "string" &&
    (typeof v["nickname"] === "string" || v["nickname"] === null) &&
    (typeof v["avatarHash"] === "string" || v["avatarHash"] === null) &&
    (typeof v["totalItems"] === "number" || v["totalItems"] === null) &&
    typeof v["firstSeen"] === "number" &&
    typeof v["lastSeen"] === "number"
  );
}

/** Reads the private record; absent, corrupt, or version-mismatched content yields `{}` and never throws. */
export function readPrivateBots(storage: StorageLike): PrivateBotRecord {
  const raw = readJson<unknown>(storage, STORAGE_KEYS.privateBots, null);
  if (typeof raw !== "object" || raw === null) return {};
  const record: PrivateBotRecord = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (isValidEntry(value) && value.steamId === key) record[key] = value;
  }
  return record;
}

/** Persists the private record. */
export function writePrivateBots(storage: StorageLike, record: PrivateBotRecord): void {
  writeJson(storage, STORAGE_KEYS.privateBots, record);
}

/**
 * Records a private partner, keeping the earliest `firstSeen`, advancing
 * `lastSeen`, and filling display fields that were previously missing.
 * Never creates duplicates: one entry per SteamID.
 */
export function upsertPrivateBot(record: PrivateBotRecord, snapshot: PrivateBotSnapshot, now: number): PrivateBotEntry {
  const existing = record[snapshot.SteamID];
  const nickname = snapshot.Nickname ?? null;
  const avatarHash = snapshot.AvatarHash ?? null;
  const totalItems = typeof snapshot.TotalInventoryCount === "number" ? snapshot.TotalInventoryCount : null;
  if (!existing) {
    const entry: PrivateBotEntry = {
      steamId: snapshot.SteamID,
      nickname,
      avatarHash,
      totalItems,
      firstSeen: now,
      lastSeen: now,
    };
    record[snapshot.SteamID] = entry;
    return entry;
  }
  existing.lastSeen = now;
  if (existing.nickname === null && nickname !== null) existing.nickname = nickname;
  if (existing.avatarHash === null && avatarHash !== null) existing.avatarHash = avatarHash;
  if (totalItems !== null) existing.totalItems = totalItems;
  return existing;
}

/** Removes one entry; returns `true` when something was removed. */
export function removePrivateBot(record: PrivateBotRecord, steamId: string): boolean {
  if (!(steamId in record)) return false;
  delete record[steamId];
  return true;
}

/** Whether the entry still needs display backfill (missing nickname or avatar). */
export function needsBackfill(entry: PrivateBotEntry): boolean {
  return entry.nickname === null || entry.avatarHash === null;
}

/**
 * Fills entries missing display data from the current bot-list cache.
 * Returns the SteamIDs still unresolved. Never overwrites known-good data.
 */
export function backfillFromBotList(record: PrivateBotRecord, partners: BotEntry[]): string[] {
  const byId = new Map(partners.map((p) => [p.SteamID, p]));
  const unresolved: string[] = [];
  for (const entry of Object.values(record)) {
    if (!needsBackfill(entry)) continue;
    const hit = byId.get(entry.steamId);
    if (!hit) {
      unresolved.push(entry.steamId);
      continue;
    }
    if (entry.nickname === null && typeof hit.Nickname === "string" && hit.Nickname !== "") {
      entry.nickname = hit.Nickname;
    }
    if (entry.avatarHash === null && typeof hit.AvatarHash === "string" && hit.AvatarHash !== "") {
      entry.avatarHash = hit.AvatarHash;
    }
    if (typeof hit.TotalInventoryCount === "number") entry.totalItems = hit.TotalInventoryCount;
    if (needsBackfill(entry)) unresolved.push(entry.steamId);
  }
  return unresolved;
}

/** Sorted list view (newest `lastSeen` first) for the config tab. */
export function listPrivateBots(record: PrivateBotRecord): PrivateBotEntry[] {
  return Object.values(record).sort((a, b) => b.lastSeen - a.lastSeen);
}

/** Minimal best-effort display parse of a Steam profile page. Never throws. */
export function parseProfileDisplay(html: string): { nickname: string | null; avatarHash: string | null } {
  try {
    const title = html.match(/<title>\s*Steam Community\s*::\s*([^<]+?)\s*<\/title>/i)?.[1]?.trim() ?? null;
    const ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ?? null;
    const hash = ogImage?.match(/avatars\.(?:cloudflare\.)?steamstatic\.com\/([0-9a-f]{32,})/i)?.[1] ?? null;
    if (title === null && hash === null) return { nickname: null, avatarHash: null };
    return { nickname: title, avatarHash: hash };
  } catch {
    return { nickname: null, avatarHash: null };
  }
}
