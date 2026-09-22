// Bot-listing cache: read/write/invalidate semantics for the ASF bot list
// (or friend list) snapshot the scanner matches against.
//
// The snapshot carries per-bot inventories, so it goes stale when trades
// happen. Freshness is a time window plus a mode match; anything else (or an
// explicit Stop) degrades to "no cache" and the next scan refetches. No DOM,
// no network: callers pass a `StorageLike` and the userscript passes real
// `localStorage` while tests pass an in-memory fake.

import type { BotsResponse } from "./models";
import { readJson, removeKey, STORAGE_KEYS, writeJson, type StorageLike } from "./storage";

/** Loads the cached bot listing, or `null` when absent, corrupt, stale, or mode-mismatched. */
export function loadBotCache(
  storage: StorageLike,
  now: number,
  ttlMs: number,
  matchFriends: boolean,
): BotsResponse | null {
  const cached = readJson<BotsResponse | null>(storage, STORAGE_KEYS.botCache, null);
  if (
    cached === null ||
    cached.cacheTime === undefined ||
    cached.cacheTime === null ||
    cached.cacheTime + ttlMs < now ||
    matchFriends !== cached.friends
  ) {
    return null;
  }
  return cached;
}

/** Persists a freshly fetched bot listing with its fetch timestamp. */
export function saveBotCache(storage: StorageLike, bots: BotsResponse, now: number): void {
  bots.cacheTime = now;
  writeJson(storage, STORAGE_KEYS.botCache, bots);
}

/** Drops the persisted bot listing so the next scan refetches it. */
export function clearBotCache(storage: StorageLike): void {
  removeKey(storage, STORAGE_KEYS.botCache);
}
