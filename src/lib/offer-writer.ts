// Pure trade-offer selection planner, extracted from `addCards` in
// `src/ASF-STM.ts` (openspec change modularize-userscript-services, slice 2.5).
//
// No DOM, XHR, `GM_*`, or storage access: the caller supplies the requested
// card names per side and the live inventory pools, and this module plans
// which copies move in which order. The userscript only applies the moves
// (`MoveItemToTrade`), shows the dialogs, and throws the aborts. Behavior is
// intentionally identical to the inline code.

import type { SteamInventoryDescription, TradableFlag } from "./models";
import { getTradableAfterTime, isTradeOfferItemTradable } from "./tradable";

/** One live trade-inventory entry as the planner sees it. */
export interface OfferPoolItem extends SteamInventoryDescription {
  market_hash_name: string;
  type: string;
  id: string;
  element: unknown;
}

/** Nested per-item description as Steam's trade-page inventory carries it
 *  (`CInventoryItem.description`): name, verdict, and hold text live here
 *  instead of top-level on the pool entry. */
export interface LivePoolDescription {
  market_hash_name?: unknown;
  tradable?: unknown;
  type?: unknown;
  descriptions?: unknown;
  owner_descriptions?: unknown;
}

/**
 * Raw live trade-page pool entry: either the flat planner shape
 * (`market_hash_name`/`tradable`/`type`/`id` top-level) or the Steam
 * `CInventoryItem` shape (those fields nested under `description`, identity
 * under `assetid`). Every pool entry the planner consumes may arrive in
 * either shape.
 */
export interface RawOfferPoolItem {
  market_hash_name?: unknown;
  tradable?: unknown;
  type?: unknown;
  id?: unknown;
  assetid?: unknown;
  element?: unknown;
  classid?: unknown;
  instanceid?: unknown;
  descriptions?: unknown;
  owner_descriptions?: unknown;
  description?: LivePoolDescription | null | undefined;
}

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

function asDescriptionLines(value: unknown): SteamInventoryDescription["descriptions"] {
  return Array.isArray(value) ? (value as SteamInventoryDescription["descriptions"]) : undefined;
}

/**
 * Normalizes one raw live-pool entry into the flat planner shape. Flat
 * top-level fields win; the nested `description` fills whatever is missing,
 * so scan-time counting and offer-time selection reason about the same
 * name and the same tradability verdict. Unknown/missing fields fail open
 * exactly like the shared verdict (no name matches nothing; no flag counts
 * as tradable). Idempotent: normalizing an already-flat item is a no-op.
 */
export function normalizeOfferPoolItem(raw: RawOfferPoolItem | OfferPoolItem | null | undefined): OfferPoolItem {
  const item = (raw ?? {}) as RawOfferPoolItem;
  const nested = (item.description ?? {}) as LivePoolDescription;
  const idValue = item.id ?? item.assetid;
  return {
    classid: asNonEmptyString(item.classid) ?? "",
    instanceid: asNonEmptyString(item.instanceid) ?? "",
    tradable: (item.tradable ?? nested.tradable) as TradableFlag | undefined,
    market_hash_name: asNonEmptyString(item.market_hash_name) ?? asNonEmptyString(nested.market_hash_name) ?? "",
    type: asNonEmptyString(item.type) ?? asNonEmptyString(nested.type) ?? "",
    id: typeof idValue === "string" ? idValue : typeof idValue === "number" ? String(idValue) : "",
    element: item.element,
    descriptions: asDescriptionLines(item.descriptions) ?? asDescriptionLines(nested.descriptions),
    owner_descriptions: asDescriptionLines(item.owner_descriptions) ?? asDescriptionLines(nested.owner_descriptions),
  };
}

/** One planned move: the inventory element to add for a requested name. */
export interface PlannedMove {
  name: string;
  type: string;
  id: string;
  element: unknown;
}

/** Per-copy diagnostic facts behind one `unselectable` or `exhausted` shortfall. */
export interface UnsuppliedCardDetail {
  /** How many pool copies carried the requested name. */
  poolCopies: number;
  /** Raw `tradable` flag values seen across those copies, in pool order. */
  flagValues: unknown[];
  /** Parsed `Tradable After` hold timestamp (ms epoch) per copy, or null. */
  holdDates: Array<number | null>;
  /**
   * Scan-time tradable count for the card when the caller has it (the offer
   * page's persisted params carry no per-card counts, so this stays unset
   * there; present only for callers that pass inventory counts in).
   */
  scanTradable?: number;
  /** 0-based index of this occurrence among same-name requests on its side. */
  occurrenceIndex: number;
  /** How many tradable pool copies of the name existed before this offer allocated any. */
  tradablePoolCopies: number;
  /** How many of those tradable copies earlier occurrences already allocated. */
  allocatedCopies: number;
}

/** One requested card occurrence the live inventory could not supply. */
export interface UnsuppliedCard {
  /** 0 = user's (send) side, 1 = partner's (receive) side. */
  side: 0 | 1;
  /** Requested `market_hash_name`. */
  name: string;
  /**
   * `absent` = no pool item carries that name; `unselectable` = the name is
   * present but every unconsumed copy is trade-held/untradable;
   * `exhausted` = tradable copies existed but earlier occurrences of the
   * same offer already consumed them all.
   */
  reason: "absent" | "unselectable" | "exhausted";
  /** Diagnostic facts for `unselectable`/`exhausted` shortfalls; absent for `absent`. */
  detail?: UnsuppliedCardDetail;
}

/** Planned moves per side plus the abort bookkeeping `addCards` uses. */
export interface OfferSelectionPlan {
  moves: [PlannedMove[], PlannedMove[]];
  failLater: boolean;
  cardTypes: [string[], string[]];
  /** One entry per requested occurrence with no selectable copy, in request order. */
  shortfalls: UnsuppliedCard[];
}

/** Random index in `[min, max)`, mirroring the inline `getRandomInt`. */
export function getRandomOfferIndex(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min)) + min;
}

/** Sorts candidate copies by card id, descending, mirroring `mySort`. */
export function sortOfferCopiesDesc(copies: Array<{ id: string }>): void {
  copies.sort((a, b) => parseInt(b.id) - parseInt(a.id));
}

/**
 * Plans both sides of the offer: for each requested name (in order) pick one
 * tradable pool copy — first (SORT: highest id) or random (RANDOM) — and flag
 * `failLater` when a name has no selectable copy. Pool entries are normalized
 * first, so flat and nested-`description` live shapes filter identically.
 * Held copies (trade-state negative or future "Tradable After") are skipped,
 * so a fully held name falls through to the missing-items abort downstream.
 * Every such occurrence is also recorded in `shortfalls` with its side and
 * reason.
 */
export function planOfferSelection(
  requested: [string[], string[]],
  pools: RawOfferPoolItem[][],
  order: string,
  randomIndex: (min: number, max: number) => number = getRandomOfferIndex,
): OfferSelectionPlan {
  const moves: [PlannedMove[], PlannedMove[]] = [[], []];
  const cardTypes: [string[], string[]] = [[], []];
  const shortfalls: UnsuppliedCard[] = [];
  let failLater = false;
  const normalizedPools = pools.map((pool) => (pool ?? []).map((item) => normalizeOfferPoolItem(item)));
  requested.forEach(function (requestedCards: string[], i: number) {
    const side = (i === 0 ? 0 : 1) as 0 | 1;
    const pool = normalizedPools[i] ?? [];
    const tmpCards: Record<string, Array<{ type: string; element: unknown; id: string }>> = {};
    for (const item of pool) {
      // add all matching cards to temporary dict
      const index = requestedCards.findIndex((elem: string) => elem === item.market_hash_name);
      if (index > -1) {
        if (!isTradeOfferItemTradable(item)) {
          continue;
        }
        const key = requestedCards[index]!;
        if (tmpCards[key] === undefined) {
          tmpCards[key] = [];
        }
        tmpCards[key]!.push({ type: item.type, element: item.element, id: item.id });
      }
    }
    if (order === "SORT") {
      // sort cards descending by card id for each type
      Object.keys(tmpCards).forEach(function (id: string) {
        sortOfferCopiesDesc(tmpCards[id]!);
      });
    }
    // add cards to trade in order given by STM
    const occurrenceSeen: Record<string, number> = {};
    const initialTradable: Record<string, number> = {};
    Object.keys(tmpCards).forEach(function (key: string) {
      initialTradable[key] = tmpCards[key]!.length;
    });
    requestedCards.forEach(function (elem: string) {
      const occurrenceIndex = occurrenceSeen[elem] ?? 0;
      occurrenceSeen[elem] = occurrenceIndex + 1;
      const currentCards = tmpCards[elem] || []; // all cards from inventory with requested signature
      if (currentCards.length === 0) {
        failLater = true;
        const present = pool.filter((item) => item.market_hash_name === elem);
        if (present.length === 0) {
          shortfalls.push({ side, name: elem, reason: "absent" });
        } else {
          const tradableTotal = initialTradable[elem] ?? 0;
          const occurrenceDetail = {
            poolCopies: present.length,
            flagValues: present.map((item) => item.tradable),
            holdDates: present.map((item) => getTradableAfterTime(item)),
            occurrenceIndex,
            tradablePoolCopies: tradableTotal,
            allocatedCopies: tradableTotal - currentCards.length,
          };
          if (tradableTotal > 0) {
            // Tradable copies existed but earlier occurrences of this offer
            // consumed them all: exhaustion, never a held-card report.
            shortfalls.push({ side, name: elem, reason: "exhausted", detail: occurrenceDetail });
          } else {
            shortfalls.push({ side, name: elem, reason: "unselectable", detail: occurrenceDetail });
          }
        }
      } else {
        let pick = 0;
        if (order === "RANDOM") {
          // randomize index
          pick = randomIndex(0, currentCards.length);
        }
        const chosen = currentCards[pick]!;
        moves[i]!.push({ name: elem, type: chosen.type, id: chosen.id, element: chosen.element });
        cardTypes[i]!.push(chosen.type);
        currentCards.splice(pick, 1);
      }
    });
  });
  return { moves, failLater, cardTypes, shortfalls };
}

/**
 * Trade-page callbacks the live retry needs, injected so the retry stays
 * unit-testable without Steam globals (same pattern as `assessTradeReadiness`).
 */
export interface LiveRetryDeps {
  /** Places one pool copy into the trade (mirrors `MoveItemToTrade`). */
  moveItem: (element: unknown) => void;
  /** Current filled-slot count for one side (mirrors `#your_slots .has_item`). */
  slotCount: (side: 0 | 1) => number;
}

/** One retry-kept copy plus the side it was placed on. */
export interface RetriedCopy {
  side: 0 | 1;
  move: PlannedMove;
}

/**
 * Ground-truth retry for `unselectable` shortfalls: for each one, attempts
 * every present pool copy the metadata plan has not already consumed and
 * keeps the first copy the live trade actually accepts (its side's slot
 * count rises). Copies the trade ignores are skipped; occurrences nothing
 * fills stay pending for the loud abort path. `usedIds` is never mutated.
 */
export function retryUnselectableCopies(
  shortfalls: UnsuppliedCard[],
  pools: RawOfferPoolItem[][],
  usedIds: ReadonlySet<string>,
  deps: LiveRetryDeps,
): { kept: RetriedCopy[]; resolved: UnsuppliedCard[]; pending: UnsuppliedCard[] } {
  const taken = new Set<string>(usedIds);
  const kept: RetriedCopy[] = [];
  const resolved: UnsuppliedCard[] = [];
  const pending: UnsuppliedCard[] = [];
  const normalizedPools = pools.map((pool) => (pool ?? []).map((item) => normalizeOfferPoolItem(item)));
  for (const shortfall of shortfalls) {
    if (shortfall.reason !== "unselectable") {
      pending.push(shortfall);
      continue;
    }
    const pool = normalizedPools[shortfall.side] ?? [];
    let placed: RetriedCopy | null = null;
    for (const item of pool) {
      if (item.market_hash_name !== shortfall.name || taken.has(item.id)) {
        continue;
      }
      let before = 0;
      try {
        before = deps.slotCount(shortfall.side);
        deps.moveItem(item.element);
      } catch {
        continue;
      }
      let after = before;
      try {
        after = deps.slotCount(shortfall.side);
      } catch {
        after = before;
      }
      if (after > before) {
        placed = {
          side: shortfall.side,
          move: { name: item.market_hash_name, type: item.type, id: item.id, element: item.element },
        };
        taken.add(item.id);
        break;
      }
    }
    if (placed !== null) {
      kept.push(placed);
      resolved.push(shortfall);
    } else {
      pending.push(shortfall);
    }
  }
  return { kept, resolved, pending };
}

/**
 * Renders the live-inventory shortfall dialog body: one line per unsupplied
 * card (`your`/`their` side, name, reason), capped at `cap` entries with a
 * `+N more` tail (the full list belongs in the debug log). Pure, so harness
 * tests can assert dialog content without a browser dialog.
 */
export function formatShortfallMessage(shortfalls: UnsuppliedCard[], cap = 10): string {
  const lines = shortfalls.slice(0, cap).map((entry) => {
    const side = entry.side === 0 ? "yours" : "theirs";
    if (entry.reason === "absent") {
      return `${side}: ${entry.name} (not in inventory)`;
    }
    if (entry.reason === "exhausted") {
      const detail = entry.detail;
      if (detail !== undefined) {
        const requested = detail.occurrenceIndex + 1;
        return (
          `${side}: ${entry.name} (requested ${requested}, ` +
          `only ${detail.tradablePoolCopies} tradable cop${detail.tradablePoolCopies === 1 ? "y" : "ies"}` +
          ` in inventory, ${detail.allocatedCopies} already used by this offer)`
        );
      }
      return `${side}: ${entry.name} (already used up by this offer)`;
    }
    return `${side}: ${entry.name} (present but not tradable right now)`;
  });
  if (shortfalls.length > cap) {
    lines.push(`+${shortfalls.length - cap} more (see debug log)`);
  }
  return (
    "The live trade inventory could not supply these matched cards:\n" +
    lines.join("\n") +
    "\nNo items were added. Check trade holds or inventory changes, then rescan."
  );
}
/**
 * Minimal structural view of a trade-page user (own + partner) for the
 * readiness poll: mirrors `user.rgContexts[753][6].inventory` and
 * `user.cLoadsInFlight` without touching Steam globals.
 */
export interface TradeReadinessUser {
  rgContexts?: Record<number, Record<number, { inventory?: unknown } | undefined> | undefined>;
  cLoadsInFlight?: number;
}

/**
 * Pure counterpart of the `checkContexts` readiness poll: counts how many of
 * the two sides have their appid-753/context-6 inventory loaded. Callers load
 * missing inventories when the count is below 2 and run the planner once it
 * reaches 2.
 */
export function assessTradeReadiness(users: TradeReadinessUser[]): number {
  let ready = 0;
  users.forEach(function (user) {
    const context = user.rgContexts?.[753]?.[6];
    if (context && user.cLoadsInFlight === 0 && context.inventory) {
      ready += 1;
    }
  });
  return ready;
}

/** Settled-readiness poll state for one consecutive-ready streak. */
export interface ReadinessStreak {
  consecutive: number;
  settled: boolean;
}

/**
 * Advances the settled-readiness streak by one poll: a fully ready check
 * extends the streak, anything else resets it. Planning proceeds once the
 * streak settles (two consecutive fully-ready polls), so a transient ready
 * between paginated inventory loads cannot trigger planning against a
 * partial pool and manufacture exhaustion shortfalls for copies present on
 * unloaded pages.
 */
export function advanceReadinessStreak(previousConsecutive: number, bothReady: boolean): ReadinessStreak {
  const consecutive = bothReady ? previousConsecutive + 1 : 0;
  return { consecutive, settled: consecutive >= 2 };
}

/**
 * Whether the two sides form a valid 1:1 trade by item type, mirroring the
 * inline type check (every partner-side type consumes one user-side type).
 */
export function isOneToOneTrade(cardTypes: [string[], string[]]): boolean {
  const mine = [...cardTypes[0]!];
  for (const type of cardTypes[1]!) {
    const index = mine.indexOf(type);
    if (index > -1) {
      mine.splice(index, 1);
    } else {
      return false;
    }
  }
  return true;
}
