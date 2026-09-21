// Canonical model declarations for ASF-STM-Enhancement.
//
// Type-only module: it exports nothing at runtime, so rolldown erases it from
// the bundle (no weight, no runtime cycles). Every shared shape has exactly one
// declaration site here; consumers use `import type`.

// ---------------------------------------------------------------------------
// Badge and matching models
// ---------------------------------------------------------------------------

/** One card slot of a badge; `number` is the slot index within the set. */
export interface MatchCard {
  item: string;
  hash: string;
  /** Owned copies (all copies, per the Steam badge page). */
  count: number;
  /**
   * Currently tradable copies (inventory scan); undefined = unknown,
   * treat as `count` (badge-page fallback).
   */
  tradableCount?: number;
  iconUrl: string;
  number: number;
}

/** A badge with its set sizes and per-slot card counts. */
export interface MatchBadge {
  appId: number;
  title: string;
  maxCards: number;
  maxSets: number;
  lastSet: number;
  cards: MatchCard[];
}

/** Domain alias for a badge. */
export type Badge = MatchBadge;

/** Domain alias for one badge card slot. */
export type BadgeCard = MatchCard;

/** A card reference accumulated into a trade side. */
export interface MatchCardRef {
  item: string;
  count: number;
  iconUrl: string;
  hash: string;
}

/** One game's accumulated cards for a single trade side. */
export interface MatchItem {
  appId: number;
  title: string;
  cards: MatchCardRef[];
}

/** One game's send/receive card-id lists, as persisted for the trade page. */
export interface MatchCards {
  send: number[];
  receive: number[];
}

// ---------------------------------------------------------------------------
// Settings, filters, and runtime state
// ---------------------------------------------------------------------------

/** One entry of the persisted scan-filter list. */
export interface ScanFilter {
  active: boolean;
  appId: string | number;
  title: string;
  appid?: number;
}

/** One persisted scan-filter entry, before validation (fields may be unusable). */
export interface ScanFilterEntry {
  appId: number | string;
  title?: unknown;
  active?: unknown;
}

/** The persisted user settings. */
export type UserSettings = {
  matchFriends: boolean;
  inventoryScanDelay: number;
  anyBots: boolean;
  fairBots: boolean;
  sortByName: boolean;
  sortBotsBy: string[];
  botMinItems: number;
  botMaxItems: number;
  weblimiter: number;
  errorLimiter: number;
  debug: boolean;
  maxErrors: number;
  filterBackgroundColor: string;
  preventClose: boolean;
  tradeMessage: string;
  autoSend: boolean;
  doAfterTrade: string;
  order: string;
  useScanFilters: boolean;
  scanFilters: ScanFilter[];
  autoAddScanFilters: boolean;
  autoDeleteScanFilters: boolean;
};

/** Trade-offer page parameters persisted between the badge page and the offer. */
export interface TradeParams {
  matches: Record<string, Record<string, MatchCards>>;
  filter: number[];
  cardNames?: string[];
}

/** One progress radial's runtime element and counters. */
export interface RadialState {
  currentStep: number;
  steps: number;
  radialElement: HTMLElement | null;
  textElement: HTMLElement | null;
}

/** The four scan progress radials. */
export interface ProgressRadials {
  scanPages: RadialState;
  badges: RadialState;
  bots: RadialState;
  botBadges: RadialState;
}

// ---------------------------------------------------------------------------
// Steam inventory payload models
// ---------------------------------------------------------------------------

/** One `tradable` flag as Steam reports it: boolean, 0/1, or "0"/"1". */
export type TradableFlag = boolean | number | string;

/** One `{ value, color }` text line from an inventory description. */
export interface SteamDescriptionLine {
  value: string;
  color?: string;
}

/** Item tag, e.g. `{ category: "item_class", internal_name: "item_class_2" }`. */
export interface SteamItemTag {
  category?: string;
  internal_name?: string;
}

/**
 * One entry of the Steam inventory `descriptions` array (appid 753,
 * context 6). Only the fields the scanner reads are required; everything
 * Steam may add alongside is ignored.
 */
export interface SteamInventoryDescription {
  classid: string;
  instanceid: string;
  tradable?: TradableFlag;
  market_fee_app?: number;
  market_hash_name?: string;
  market_tradable_restriction?: number;
  type?: string;
  tags?: SteamItemTag[];
  descriptions?: SteamDescriptionLine[];
  owner_descriptions?: SteamDescriptionLine[];
}

/** One entry of the Steam inventory `assets` array. */
export interface SteamInventoryAsset {
  classid: string;
  instanceid: string;
}

/** Paged inventory payload as assembled by the scanner. */
export interface InventoryData {
  descriptions: SteamInventoryDescription[];
  assets: SteamInventoryAsset[];
}

/** Derived card data for one market hash of a game, from the inventory fetch. */
export interface InventoryCardData {
  /** All copies owned, held included. */
  owned: number;
  /** Copies currently tradable. */
  tradable: number;
}

/** Derived card data per appId per market hash name. */
export type InventoryCardCounts = Record<string, Record<string, InventoryCardData>>;

/** One badge entry of the badges database used for eligibility. */
export interface BadgeCardInfo {
  size: number;
  name?: string;
}

/** Per-game eligibility derived from inventory card data. */
export interface ScanEligibilityEntry {
  data: Record<string, InventoryCardData>;
  max_size: number;
  unbalanced: boolean | undefined;
}

// ---------------------------------------------------------------------------
// Bot list models
// ---------------------------------------------------------------------------

// Steam bot-list entry as consumed from the ASF API (plus friend-mode extras).
export interface BotEntry {
  SteamID: string;
  Nickname: string;
  AvatarHash: string | null;
  TradeToken?: string | null;
  SteamIDText?: string;
  MatchEverything: boolean;
  TotalInventoryCount: number;
  TotalGamesCount?: number;
  TotalItemsCount?: number;
  MatchableTypes: number[];
  MaxTradeHoldDuration?: number;
  itemsToSend?: MatchItem[];
  itemsToReceive?: MatchItem[];
}

/** The bot-list API envelope as cached by the scanner. */
export interface BotsResponse {
  Success: boolean;
  Message?: string;
  Result: BotEntry[];
  cacheTime?: number;
  friends?: boolean;
}
