// Shared tradability helpers for ASF-STM-Enhancement.
//
// Single source of truth: vitest imports this module directly and the lib is
// bundled into the single-file userscript via the normal rolldown import.
// Shared model shapes live in ./models and are re-exported here so existing
// consumers keep their import path.
//
// Logging: debugPrint() only exists when the host defines it; the typeof guard
// below is safe in the userscript and in vitest (tests capture the message).
declare global {
  // eslint-disable-next-line no-var
  var debugPrint: ((message: string) => void) | undefined;
}

import type {
  BadgeCardInfo,
  InventoryCardCounts,
  InventoryCardData,
  InventoryData,
  MatchBadge,
  MatchCard,
  ScanEligibilityEntry,
  SteamDescriptionLine,
  SteamInventoryAsset,
  SteamInventoryDescription,
  SteamItemTag,
  TradableFlag,
} from "./models";

export type {
  BadgeCardInfo,
  InventoryCardCounts,
  InventoryCardData,
  InventoryData,
  MatchBadge,
  MatchCard,
  ScanEligibilityEntry,
  SteamDescriptionLine,
  SteamInventoryAsset,
  SteamInventoryDescription,
  SteamItemTag,
  TradableFlag,
};

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

/** One card description reduced to the fields the counting pass needs. */
interface CardDescriptionInfo {
  appId: number;
  hash: string;
  tradable: boolean;
}

export function buildInventoryCardCounts(inventoryData: InventoryData): InventoryCardCounts {
  const counts: InventoryCardCounts = {};
  const cardByClassId = new Map<string, CardDescriptionInfo>();

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
    const hash = description.market_hash_name;
    if (!hash) {
      continue;
    }

    cardByClassId.set(description.classid, {
      appId,
      hash,
      tradable: isCurrentlyTradableDescription(description),
    });
  }

  for (const asset of inventoryData.assets) {
    const card = cardByClassId.get(asset.classid);
    if (!card) {
      continue;
    }

    let perApp = counts[card.appId];
    if (perApp === undefined) {
      perApp = counts[card.appId] = {};
    }

    const entry = perApp[card.hash];
    if (entry === undefined) {
      perApp[card.hash] = {
        owned: 1,
        tradable: card.tradable ? 1 : 0,
      };
    } else {
      entry.owned += 1;
      if (card.tradable) {
        entry.tradable += 1;
      }
    }
  }

  if (typeof debugPrint === "function") {
    debugPrint(`Tradability: ${Object.keys(counts).length} card app(s) counted from the inventory`);
  }

  return counts;
}

// Maps derived inventory card data onto the badges database: only games present
// in the database get an entry, each flagged `unbalanced` (the scanner's
// eligibility boolean) when a swap could exist for some partner - i.e. the
// badge has at least one receivable slot (owned below the applicable set
// target) AND at least one offerable slot (currently tradable copies above
// that target, surplus = max(tradable - target, 0) > 0). Targets mirror the
// badge page and the matcher: maxSets = floor(total / size),
// lastSet = ceil(total / size); badge state 0 trades against maxSets, state 1
// against lastSet (state 2 - nothing to do - is never eligible). Cards absent
// from the inventory count as owned 0 (missing cards count as zero owned
// copies). Tradability unknown reaches this gate as tradable == owned
// (badge-page fallback upstream), so the surplus rule then degrades to
// owned - target.
export function buildScanEligibility(
  inventoryCardCounts: InventoryCardCounts,
  badgeCardData: Record<string, BadgeCardInfo>,
): Record<string, ScanEligibilityEntry> {
  const scanResult: Record<string, ScanEligibilityEntry> = {};

  /* Map derived card data to appId */
  for (const appId of Object.keys(inventoryCardCounts)) {
    const badge = badgeCardData[appId];
    const perApp = inventoryCardCounts[appId];
    if (!badge || !perApp) {
      continue;
    }

    scanResult[appId] = {
      data: perApp,
      max_size: badge.size,
      unbalanced: undefined,
    };
  }

  /* Check which appIds can actually trade (receivable slot + tradable surplus) */
  for (const appId in scanResult) {
    const entry = scanResult[appId];
    if (!entry) {
      continue;
    }
    const { data, max_size } = entry;

    const cards = Object.values(data);
    const total = cards.reduce((acc, card) => acc + card.owned, 0);
    const maxSets = Math.floor(total / max_size);
    const lastSet = Math.ceil(total / max_size);

    // min/max owned counts across all `max_size` slots of the set (absent
    // cards contribute 0), mirroring the matcher's sorted-badge state rule.
    const missingSlots = max_size > cards.length ? max_size - cards.length : 0;
    const min = missingSlots > 0 ? 0 : cards.reduce((m, card) => Math.min(m, card.owned), Number.POSITIVE_INFINITY);
    const max = cards.reduce((m, card) => Math.max(m, card.owned), 0);
    const state = min !== maxSets ? 0 : max === lastSet ? 2 : 1;

    const target = state === 0 ? maxSets : lastSet;
    const receivable = (missingSlots > 0 && target > 0) || cards.some((card) => card.owned < target);
    const offerable = cards.some((card) => card.tradable > target);

    entry.unbalanced = state !== 2 && receivable && offerable;
  }

  return scanResult;
}

// Derives one candidate badge from a known card list (bundled dataset or the
// browser card cache) combined with the inventory counting pass: every card of
// the set becomes a slot - zero-owned cards included, so the receive side can
// resolve them - with owned/tradable counts taken from the inventory. Returns
// undefined when the data cannot produce a trustworthy badge: set sizes below
// the five-card minimum (the old badge-API guard) or a card list whose length
// disagrees with the set size.
export function buildBadgeFromCardList(
  appId: number,
  title: string,
  size: number,
  cardList: Array<{ hash: string; title?: string; iconUrl?: string }>,
  cardCounts: InventoryCardCounts,
): MatchBadge | undefined {
  if (size < 5) {
    return undefined;
  }
  if (cardList.length !== size) {
    return undefined;
  }

  const cards: MatchCard[] = cardList.map((card, index) => {
    const perHash = cardCounts[appId]?.[card.hash];
    return {
      item: card.title ?? card.hash,
      hash: card.hash,
      count: perHash?.owned ?? 0,
      tradableCount: perHash?.tradable ?? 0,
      iconUrl: card.iconUrl ?? "",
      number: index,
    };
  });

  return {
    appId,
    title,
    maxCards: size,
    maxSets: 0,
    lastSet: 0,
    cards,
  };
}
