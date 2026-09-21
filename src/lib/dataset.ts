// Bundled card dataset and the browser-persisted badge card cache.
//
// One dataset is inlined into the userscript at build time (rolldown) from
// `data/badge_cards.json`: rich entries with full card lists (exact market
// hashes plus display titles and icon paths) and size-only entries folded in
// from the old counts export. Icon paths omit the shared `BUNDLED_ICON_URL_PREFIX`
// bytes, re-attached by `normalizeDataset`. Set sizes resolve with no network
// request. The browser cache stores badge card lists learned from the
// badge-detail API so later scans skip games that are already known.
// Resolution merges the bundled dataset first, then the cache.

import type { StorageLike } from "./storage";
import { readJson, writeJson } from "./storage";

/** One card of a game's set in the bundled dataset. */
export interface BadgeDatasetCard {
  /** Exact `market_hash_name` of the card. */
  hash: string;
  /** Display title, when known (badge-cards dataset). */
  title?: string;
  /** Card artwork URL, when known (badge-cards dataset). */
  iconUrl?: string;
}

/** One game's entry in the bundled dataset. */
export interface BadgeDatasetEntry {
  /** Number of cards in the game's set. */
  size: number;
  /** Badge display name, when known. */
  name?: string;
  /** Every card in the set. */
  cards?: BadgeDatasetCard[];
}

/** The bundled dataset: appId -> entry. */
export type BadgeDataset = Record<string, BadgeDatasetEntry>;

/**
 * Shared prefix stripped from every bundled icon path in the compact dataset
 * encoding. All Steam economy image URLs in the export start with these bytes;
 * the export step asserts that on every regeneration and fails on mismatch.
 */
export const BUNDLED_ICON_URL_PREFIX =
  "https://community.fastly.steamstatic.com/economy/image/IzMF03bk9WpSBq-S-ekoE33L-iLqGFHVaU25ZzQNQcXdA3g5gMEPvUZZEfSMJ6dESN8p_2SVTY7V2N";

/** Re-attaches the shared prefix to a compact icon path (full URLs pass through). */
export function expandBundledIconUrl(icon: string): string {
  return icon.startsWith("http") ? icon : BUNDLED_ICON_URL_PREFIX + icon;
}

/** One game's entry in the browser-persisted card cache. */
export interface BadgeCardCacheEntry {
  size?: number;
  name?: string;
  cards?: Array<{ hash: string; title?: string; iconUrl?: string }>;
}

/** The browser-persisted card cache: appId -> entry. */
export type BadgeCardCache = Record<string, BadgeCardCacheEntry>;

/** Versioned localStorage key for the learned card cache. */
export const BADGE_CARDS_STORAGE_KEY = "TempAsfStm.ASF.STM.BadgeCards.v1";

/**
 * Normalizes any supported dataset shape into a `BadgeDataset`:
 * - the counts-only export (`[{"app_id": "1000010", "card_count": "5"}, ...]`)
 * - the counts record (`{"1000010": {"size": 5, "name"?: ..., "cards"?: ["hash", ...]}}`;
 *   string hashes are wrapped as `{ hash }`)
 * - the badge-cards record (`{"1000010": {"size": 5, "cards"?: [{"hash": ..., "title"?: ..., "iconUrl"?: ...}]}}`)
 * - the compact encoding (short keys `s`/`n`/`c`/`h`/`t`/`u`; `u` holds the
 *   icon path with `BUNDLED_ICON_URL_PREFIX` stripped)
 *
 * Invalid entries are ignored; the rest still load. An entry whose `cards`
 * array holds no usable card keeps its `size` and loses only the card list.
 */
export function normalizeDataset(raw: unknown): BadgeDataset {
  const dataset: BadgeDataset = {};

  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (typeof entry !== "object" || entry === null) {
        continue;
      }
      const record = entry as Record<string, unknown>;
      const appId = record["app_id"];
      const size = Number(record["card_count"]);
      if (typeof appId !== "string" && typeof appId !== "number") {
        continue;
      }
      if (!Number.isFinite(size) || size <= 0) {
        continue;
      }
      dataset[String(appId)] = { size };
    }
    return dataset;
  }

  if (typeof raw === "object" && raw !== null) {
    for (const [appId, value] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof value !== "object" || value === null) {
        continue;
      }
      const record = value as Record<string, unknown>;
      const size = record["size"] ?? record["s"];
      if (typeof size !== "number" || !Number.isFinite(size) || size <= 0) {
        continue;
      }
      const entry: BadgeDatasetEntry = { size };
      const name = record["name"] ?? record["n"];
      if (typeof name === "string") {
        entry.name = name;
      }
      const rawCards = record["cards"] ?? record["c"];
      if (Array.isArray(rawCards)) {
        const cards: BadgeDatasetCard[] = [];
        for (const card of rawCards) {
          if (typeof card === "string") {
            if (card.length > 0) {
              cards.push({ hash: card });
            }
            continue;
          }
          if (typeof card !== "object" || card === null) {
            continue;
          }
          const cardRecord = card as Record<string, unknown>;
          const hash = cardRecord["hash"] ?? cardRecord["h"];
          if (typeof hash !== "string" || hash.length === 0) {
            continue;
          }
          const normalized: BadgeDatasetCard = { hash };
          const title = cardRecord["title"] ?? cardRecord["t"];
          if (typeof title === "string") {
            normalized.title = title;
          }
          const iconUrl = cardRecord["iconUrl"] ?? cardRecord["u"];
          if (typeof iconUrl === "string") {
            normalized.iconUrl = expandBundledIconUrl(iconUrl);
          }
          cards.push(normalized);
        }
        if (cards.length > 0) {
          entry.cards = cards;
        }
      }
      dataset[appId] = entry;
    }
  }

  return dataset;
}

/** Reads the learned card cache, ignoring corrupt or unknown content. */
export function readBadgeCardCache(storage: StorageLike): BadgeCardCache {
  const raw = readJson<unknown>(storage, BADGE_CARDS_STORAGE_KEY, {});
  const cache: BadgeCardCache = {};
  if (typeof raw !== "object" || raw === null) {
    return cache;
  }
  for (const [appId, value] of Object.entries(raw)) {
    if (typeof value !== "object" || value === null) {
      continue;
    }
    const record = value as Record<string, unknown>;
    const entry: BadgeCardCacheEntry = {};
    if (typeof record["size"] === "number" && Number.isFinite(record["size"])) {
      entry.size = record["size"];
    }
    if (typeof record["name"] === "string") {
      entry.name = record["name"];
    }
    if (Array.isArray(record["cards"])) {
      const cards: Array<{ hash: string; title?: string; iconUrl?: string }> = [];
      for (const card of record["cards"]) {
        if (typeof card !== "object" || card === null) {
          continue;
        }
        const hash = (card as Record<string, unknown>)["hash"];
        if (typeof hash !== "string" || hash.length === 0) {
          continue;
        }
        const learned: { hash: string; title?: string; iconUrl?: string } = { hash };
        const title = (card as Record<string, unknown>)["title"];
        if (typeof title === "string") {
          learned.title = title;
        }
        const iconUrl = (card as Record<string, unknown>)["iconUrl"];
        if (typeof iconUrl === "string") {
          learned.iconUrl = iconUrl;
        }
        cards.push(learned);
      }
      if (cards.length > 0) {
        entry.cards = cards;
      }
    }
    if (entry.size !== undefined || entry.name !== undefined || entry.cards !== undefined) {
      cache[appId] = entry;
    }
  }
  return cache;
}

/** Persists one learned game into the cache (read-modify-write). */
export function writeBadgeCardCacheEntry(
  storage: StorageLike,
  cache: BadgeCardCache,
  appId: number,
  entry: BadgeCardCacheEntry,
): void {
  cache[String(appId)] = entry;
  writeJson(storage, BADGE_CARDS_STORAGE_KEY, cache);
}

/**
 * Merges the single bundled dataset and the browser cache for one game: the
 * bundled entry wins on conflicts, then the cache fills in what the dataset
 * lacks.
 */
export function resolveBadgeEntry(
  dataset: BadgeDataset,
  cache: BadgeCardCache,
  appId: number,
): { size?: number; name?: string; cards?: Array<{ hash: string; title?: string; iconUrl?: string }> } {
  const datasetEntry = dataset[String(appId)];
  const cacheEntry = cache[String(appId)];
  return {
    size: datasetEntry?.size ?? cacheEntry?.size,
    name: datasetEntry?.name ?? cacheEntry?.name,
    cards: datasetEntry?.cards ?? cacheEntry?.cards,
  };
}
