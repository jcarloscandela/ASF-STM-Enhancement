// Shared tradability helpers for ASF-STM-Enhancement.
//
// Single source of truth: vitest imports this module directly, and the build
// script compiles it and inlines the output into the userscript
// (TRADABLE_LIB slot) so the distributed userscripts stay single-file.
//
// Logging: debugPrint() only exists in the debug userscript build (the release
// build strips its definition). The typeof guard below is safe in all three
// contexts: debug build logs, release build and vitest stay silent unless the
// host defines a global debugPrint (tests use that to capture the message).
declare global {
  // eslint-disable-next-line no-var
  var debugPrint: ((message: string) => void) | undefined;
}

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

/** Tradable card copies per appId per market hash name. */
export type TradableCardCounts = Record<string, Record<string, number>>;

/** One badge entry of the badges database used for eligibility. */
export interface BadgeCardInfo {
  size: number;
  name?: string;
}

/** Per-game eligibility derived from tradable copies. */
export interface ScanEligibilityEntry {
  data: Record<string, number>;
  max_size: number;
  unbalanced: boolean | undefined;
}

export function isTradableDescription(description: SteamInventoryDescription): boolean {
  // `tradable` is the current trade state. `market_tradable_restriction` is only the
  // post-market cooldown period (e.g. 7) and is present even on tradable items, so it
  // must not be used to decide tradability here.
  return description.tradable !== false && description.tradable !== 0 && description.tradable !== "0";
}

// Time-gated trade holds ("Tradable After <date>").
//
// Steam renders a per-item hold as a "Tradable After" text line inside the description
// text (the `descriptions` / `owner_descriptions` entries of the inventory response,
// mirrored on the trade-offer page). The line only appears while a hold is active, so
// a parseable date in the future means the copy cannot be traded yet. Anything
// unparseable fails open: the `tradable` flag verdict applies (see
// isCurrentlyTradableDescription). The fixed post-market cooldown field
// (`market_tradable_restriction`) is never consulted here.
const TRADABLE_AFTER_MARKER = /tradable\s+after/i;

function stripMarkup(value: string): string {
  return value.replace(/<[^>]*>/g, " ");
}

function descriptionHoldTexts(description: SteamInventoryDescription): string[] {
  const texts: string[] = [];
  const keys = ["descriptions", "owner_descriptions"] as const;
  for (const key of keys) {
    const lines = description[key];
    if (!Array.isArray(lines)) {
      continue;
    }
    for (const line of lines) {
      if (line && typeof line.value === "string" && TRADABLE_AFTER_MARKER.test(line.value)) {
        texts.push(stripMarkup(line.value));
      }
    }
  }
  return texts;
}

function monthNameToIndex(name: string): number {
  const months = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ];
  const lower = name.toLowerCase();
  return months.findIndex((month) => month.startsWith(lower));
}

function toTimestamp(
  year: number,
  monthIndex: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
): number | null {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(monthIndex) ||
    !Number.isInteger(day) ||
    monthIndex < 0 ||
    monthIndex > 11 ||
    day < 1 ||
    day > 31 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59
  ) {
    return null;
  }
  return new Date(year, monthIndex, day, hour, minute, second).getTime();
}

// Parses every "Tradable After" date found in a description and returns the latest
// hold timestamp (ms epoch), or null when no date can be parsed. Pure parse step:
// callers decide what "future" means by comparing against their clock.
export function getTradableAfterTime(description: SteamInventoryDescription): number | null {
  let latest: number | null = null;
  const consider = (timestamp: number | null): void => {
    if (timestamp !== null && (latest === null || timestamp > latest)) {
      latest = timestamp;
    }
  };

  for (const text of descriptionHoldTexts(description)) {
    let match: RegExpExecArray | null;

    // ISO: 2026-09-26, optional time.
    const isoRe = /(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?/g;
    while ((match = isoRe.exec(text)) !== null) {
      if (match[1] === undefined || match[2] === undefined || match[3] === undefined) {
        continue;
      }
      consider(
        toTimestamp(
          Number(match[1]),
          Number(match[2]) - 1,
          Number(match[3]),
          Number(match[4] ?? 0),
          Number(match[5] ?? 0),
          Number(match[6] ?? 0),
        ),
      );
    }

    // Month names: "Sep 26, 2026", "26 Sep 2026", "September 26, 2026", optional time.
    const monthRe =
      /(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?/gi;
    const monthDayYearRe = new RegExp(
      monthRe.source +
        "\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})" +
        "(?:\\s*(?:@|at|,)?\\s*(\\d{1,2}):(\\d{2})(?::(\\d{2}))?\\s*(am|pm)?)?",
      "gi",
    );
    while ((match = monthDayYearRe.exec(text)) !== null) {
      if (match[1] === undefined || match[2] === undefined || match[3] === undefined) {
        continue;
      }
      let hour = Number(match[4] ?? 0);
      const meridiem = (match[7] ?? "").toLowerCase();
      if (meridiem === "pm" && hour < 12) {
        hour += 12;
      }
      if (meridiem === "am" && hour === 12) {
        hour = 0;
      }
      consider(
        toTimestamp(
          Number(match[3]),
          monthNameToIndex(match[1]),
          Number(match[2]),
          hour,
          Number(match[5] ?? 0),
          Number(match[6] ?? 0),
        ),
      );
    }
    const dayMonthYearRe = new RegExp(
      "(\\d{1,2})(?:st|nd|rd|th)?\\s+" +
        monthRe.source +
        "\\.?\\s*,?\\s+(\\d{4})" +
        "(?:\\s*(?:@|at|,)?\\s*(\\d{1,2}):(\\d{2})(?::(\\d{2}))?)?",
      "gi",
    );
    while ((match = dayMonthYearRe.exec(text)) !== null) {
      if (match[1] === undefined || match[2] === undefined || match[3] === undefined) {
        continue;
      }
      consider(
        toTimestamp(
          Number(match[3]),
          monthNameToIndex(match[2]),
          Number(match[1]),
          Number(match[4] ?? 0),
          Number(match[5] ?? 0),
          Number(match[6] ?? 0),
        ),
      );
    }

    // Numeric: 26/09/2026 or 09/26/2026, optional time. The inventory is fetched
    // with l=english, so an ambiguous all-small date reads month-first; an
    // out-of-range part disambiguates day-first (e.g. 26/09/2026).
    const numericRe = /(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/g;
    while ((match = numericRe.exec(text)) !== null) {
      if (match[1] === undefined || match[2] === undefined || match[3] === undefined) {
        continue;
      }
      const first = Number(match[1]);
      const second = Number(match[2]);
      let year = Number(match[3]);
      if (year < 100) {
        year += 2000;
      }
      const dayFirst = first > 12 || second > 12 ? first > 12 : false;
      const month = (dayFirst ? second : first) - 1;
      const day = dayFirst ? first : second;
      consider(toTimestamp(year, month, day, Number(match[4] ?? 0), Number(match[5] ?? 0), Number(match[6] ?? 0)));
    }
  }
  return latest;
}

export function hasFutureTradeHold(description: SteamInventoryDescription, now?: number): boolean {
  const current = now === undefined ? Date.now() : now;
  const holdTime = getTradableAfterTime(description);
  return holdTime !== null && holdTime > current;
}

// Full verdict for one inventory description: the `tradable` flag AND the
// time-gated hold must both allow trading right now.
export function isCurrentlyTradableDescription(description: SteamInventoryDescription, now?: number): boolean {
  return isTradableDescription(description) && !hasFutureTradeHold(description, now);
}

// Verdict for one live trade-offer inventory entry (`rgInventory` items mirror the
// description shape: a `tradable` flag plus `descriptions` text lines).
export function isTradeOfferItemTradable(item: SteamInventoryDescription | null | undefined, now?: number): boolean {
  if (!item) {
    return true;
  }
  return isCurrentlyTradableDescription(item, now);
}

export function buildTradableCardCounts(inventoryData: InventoryData): TradableCardCounts {
  const counts: TradableCardCounts = {};
  const descriptionByClassInstance = new Map<string, SteamInventoryDescription>();
  const heldClassInstances = new Set<string>();
  let excluded = 0;

  for (const description of inventoryData.descriptions) {
    const isCard = description.tags?.some(
      (tag) => tag.category === "item_class" && tag.internal_name === "item_class_2",
    );
    const isRegular = description.tags?.some((tag) => tag.internal_name === "cardborder_0");

    if (!isCard || !isRegular) {
      continue;
    }

    const appId = description.market_fee_app;
    if (appId === undefined) {
      continue;
    }

    if (!(appId in counts)) {
      counts[appId] = {};
    }

    const classInstance = `${description.classid}_${description.instanceid}`;

    if (!isCurrentlyTradableDescription(description)) {
      heldClassInstances.add(classInstance);
      continue;
    }

    descriptionByClassInstance.set(classInstance, description);
  }

  for (const asset of inventoryData.assets) {
    const classInstance = `${asset.classid}_${asset.instanceid}`;
    const description = descriptionByClassInstance.get(classInstance);

    if (!description) {
      if (heldClassInstances.has(classInstance)) {
        excluded++;
      }
      continue;
    }

    const hash = description.market_hash_name;
    if (!hash) {
      continue;
    }

    const appCounts = description.market_fee_app !== undefined ? counts[description.market_fee_app] : undefined;
    if (!appCounts) {
      continue;
    }
    appCounts[hash] = (appCounts[hash] ?? 0) + 1;
  }

  if (typeof debugPrint === "function") {
    debugPrint(`Tradability: ${Object.keys(counts).length} card app(s), ${excluded} trade-held card(s) excluded`);
  }

  return counts;
}

// Owned-count override used by GetOwnCards: tradable counts win when known,
// otherwise fall back to the Steam badge-page `owned` value.
//   tradableCardCounts === null/undefined  -> unknown, use ownedFallback
//   appId absent from lookup              -> unknown for this badge, use ownedFallback
//   appId present (even with empty map)   -> known, missing hashes count as 0
export function resolveOwnedCount(
  tradableCardCounts: TradableCardCounts | null | undefined,
  appId: number,
  marketHash: string,
  ownedFallback: number,
): number {
  if (tradableCardCounts === null || tradableCardCounts === undefined) {
    return ownedFallback;
  }
  const perApp = tradableCardCounts[appId];
  if (!perApp) {
    return ownedFallback;
  }
  return perApp[marketHash] ?? 0;
}

// Maps tradable card counts onto the badges database: only games present in the
// database get an entry, each flagged `unbalanced` when the tradable copies are
// unevenly distributed (i.e. the badge is worth matching).
export function buildScanEligibility(
  tradableCardCounts: TradableCardCounts,
  badgeCardData: Record<string, BadgeCardInfo>,
): Record<string, ScanEligibilityEntry> {
  const scanResult: Record<string, ScanEligibilityEntry> = {};

  /* Map tradable card counts to appId */
  for (const appId of Object.keys(tradableCardCounts)) {
    const badge = badgeCardData[appId];
    const perApp = tradableCardCounts[appId];
    if (!badge || !perApp) {
      continue;
    }

    scanResult[appId] = {
      data: perApp,
      max_size: badge.size,
      unbalanced: undefined,
    };
  }

  /* Check for unbalanced appIds */
  for (const appId in scanResult) {
    const entry = scanResult[appId];
    if (!entry) {
      continue;
    }
    const { data, max_size } = entry;

    const counts = Object.values(data);
    const count = counts.reduce((acc, a) => acc + a, 0);
    const size = Object.keys(data).length;

    const min = Math.floor(count / max_size);
    const max = Math.ceil(count / max_size);

    entry.unbalanced = counts.some((c) => c !== min && c !== max);

    // Missing classids count as 0
    if (size < max_size && min > 0) {
      entry.unbalanced = true;
    }
  }

  return scanResult;
}
