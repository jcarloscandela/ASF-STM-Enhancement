// Runtime validation + inferred types for the Steam payloads the scanner
// consumes.
//
// Built on `zod/mini`: its functional API tree-shakes down to only the
// validators actually used (measured +5.5 KB in the single-file bundle vs
// +126 KB for full `zod`). Schemas are lenient by design — unknown Steam
// fields are ignored, and unusable entries are reported to the caller so a
// scan can skip them instead of aborting.
//
// Contracts:
//   - `parseInventoryDescriptions` / `parseInventoryAssets` validate the
//     inventory payload, returning only usable entries.
//   - `parseBadgeCard` / `parseBotEntry` validate badge and bot-list entries.
//   - Tradability interpretation stays in `./tradable` (single source of truth).

import { z } from "zod/mini";

import type {
  InventoryData,
  SteamDescriptionLine,
  SteamInventoryAsset,
  SteamInventoryDescription,
  SteamItemTag,
  TradableFlag,
} from "./models";

export type {
  InventoryData,
  SteamDescriptionLine,
  SteamInventoryAsset,
  SteamInventoryDescription,
  SteamItemTag,
  TradableFlag,
};

/** One badge-page card entry (`rgCards`) as read by the scanner. */
export interface BadgeCardEntry {
  title: string;
  markethash: string;
  owned: number;
  imgurl: string;
}

/** One bot-list entry as consumed from the ASF API. */
export interface BotListEntry {
  SteamID: string;
  SteamIDText?: string;
  Nickname?: string;
  AvatarHash?: string | null;
  TradeToken?: string | null;
  MatchEverything?: boolean;
  MatchableTypes?: number[];
  TotalInventoryCount?: number;
  TotalGamesCount?: number;
  TotalItemsCount?: number;
}

// `tradable` accepts the documented flag variants and coerces them to a
// canonical form; anything else is left untouched so the tradable helpers can
// fail open exactly as before.
const tradableFlagSchema = z.union([z.boolean(), z.number(), z.string(), z.undefined()]);

const descriptionLineSchema = z.looseObject({
  value: z.string(),
  color: z.optional(z.string()),
});

const itemTagSchema = z.looseObject({
  category: z.optional(z.string()),
  internal_name: z.optional(z.string()),
});

const inventoryDescriptionSchema = z.looseObject({
  classid: z.union([z.string(), z.number()]),
  instanceid: z.union([z.string(), z.number()]),
  tradable: z.optional(tradableFlagSchema),
  market_fee_app: z.optional(z.number()),
  market_hash_name: z.optional(z.string()),
  market_tradable_restriction: z.optional(z.number()),
  type: z.optional(z.string()),
  tags: z.optional(z.array(itemTagSchema)),
  descriptions: z.optional(z.array(descriptionLineSchema)),
  owner_descriptions: z.optional(z.array(descriptionLineSchema)),
});

const inventoryAssetSchema = z.looseObject({
  classid: z.union([z.string(), z.number()]),
  instanceid: z.union([z.string(), z.number()]),
});

const badgeCardSchema = z.looseObject({
  title: z.string(),
  markethash: z.string(),
  owned: z.union([z.number(), z.string()]),
  imgurl: z.optional(z.string()),
});

const botEntrySchema = z.looseObject({
  SteamID: z.union([z.string(), z.number()]),
  SteamIDText: z.optional(z.string()),
  Nickname: z.optional(z.string()),
  AvatarHash: z.optional(z.union([z.string(), z.null()])),
  TradeToken: z.optional(z.union([z.string(), z.null()])),
  MatchEverything: z.optional(z.boolean()),
  MatchableTypes: z.optional(z.array(z.number())),
  TotalInventoryCount: z.optional(z.number()),
  TotalGamesCount: z.optional(z.number()),
  TotalItemsCount: z.optional(z.number()),
});

function toStringId(value: string | number): string {
  return typeof value === "string" ? value : String(value);
}

/** Validate one inventory description; returns undefined when unusable. */
export function parseInventoryDescription(value: unknown): SteamInventoryDescription | undefined {
  const parsed = inventoryDescriptionSchema.safeParse(value);
  if (!parsed.success) {
    return undefined;
  }
  const entry = parsed.data as SteamInventoryDescription;
  return { ...entry, classid: toStringId(entry.classid), instanceid: toStringId(entry.instanceid) };
}

/** Validate one inventory asset; returns undefined when unusable. */
export function parseInventoryAsset(value: unknown): SteamInventoryAsset | undefined {
  const parsed = inventoryAssetSchema.safeParse(value);
  if (!parsed.success) {
    return undefined;
  }
  const entry = parsed.data as SteamInventoryAsset;
  return { ...entry, classid: toStringId(entry.classid), instanceid: toStringId(entry.instanceid) };
}

/** Validate a whole inventory payload, dropping unusable entries. */
export function parseInventoryPayload(value: unknown): InventoryData {
  const source =
    value !== null && typeof value === "object" ? (value as { descriptions?: unknown; assets?: unknown }) : {};
  const descriptions: SteamInventoryDescription[] = [];
  const assets: SteamInventoryAsset[] = [];

  if (Array.isArray(source.descriptions)) {
    for (const raw of source.descriptions) {
      const parsed = parseInventoryDescription(raw);
      if (parsed) {
        descriptions.push(parsed);
      }
    }
  }
  if (Array.isArray(source.assets)) {
    for (const raw of source.assets) {
      const parsed = parseInventoryAsset(raw);
      if (parsed) {
        assets.push(parsed);
      }
    }
  }

  return { descriptions, assets };
}

/** Validate one badge-page card entry; returns undefined when unusable. */
export function parseBadgeCard(value: unknown): BadgeCardEntry | undefined {
  const parsed = badgeCardSchema.safeParse(value);
  if (!parsed.success) {
    return undefined;
  }
  const entry = parsed.data as { title: string; markethash: string; owned: number | string; imgurl?: string };
  if (entry.markethash.length === 0) {
    return undefined;
  }
  const owned = typeof entry.owned === "number" ? entry.owned : Number(entry.owned);
  if (!Number.isFinite(owned)) {
    return undefined;
  }
  return { title: entry.title, markethash: entry.markethash, owned, imgurl: entry.imgurl ?? "" };
}

/** Validate one bot-list entry; returns undefined when unusable. */
export function parseBotEntry(value: unknown): BotListEntry | undefined {
  const parsed = botEntrySchema.safeParse(value);
  if (!parsed.success) {
    return undefined;
  }
  const entry = parsed.data as BotListEntry & { SteamID: string | number };
  const steamId = toStringId(entry.SteamID);
  if (!/^\d+$/.test(steamId)) {
    return undefined;
  }
  return { ...entry, SteamID: steamId };
}
