// Pure trade-offer selection planner, extracted from `addCards` in
// `src/ASF-STM.ts` (openspec change modularize-userscript-services, slice 2.5).
//
// No DOM, XHR, `GM_*`, or storage access: the caller supplies the requested
// card names per side and the live inventory pools, and this module plans
// which copies move in which order. The userscript only applies the moves
// (`MoveItemToTrade`), shows the dialogs, and throws the aborts. Behavior is
// intentionally identical to the inline code.

import type { SteamInventoryDescription } from "./models";
import { isTradeOfferItemTradable } from "./tradable";

/** One live trade-inventory entry as the planner sees it. */
export interface OfferPoolItem extends SteamInventoryDescription {
  market_hash_name: string;
  type: string;
  id: string;
  element: unknown;
}

/** One planned move: the inventory element to add for a requested name. */
export interface PlannedMove {
  name: string;
  type: string;
  id: string;
  element: unknown;
}

/** Planned moves per side plus the abort bookkeeping `addCards` uses. */
export interface OfferSelectionPlan {
  moves: [PlannedMove[], PlannedMove[]];
  failLater: boolean;
  cardTypes: [string[], string[]];
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
 * `failLater` when a name has no selectable copy. Held copies
 * (trade-state negative or future "Tradable After") are skipped, so a fully
 * held name falls through to the missing-items abort downstream.
 */
export function planOfferSelection(
  requested: [string[], string[]],
  pools: OfferPoolItem[][],
  order: string,
  randomIndex: (min: number, max: number) => number = getRandomOfferIndex,
): OfferSelectionPlan {
  const moves: [PlannedMove[], PlannedMove[]] = [[], []];
  const cardTypes: [string[], string[]] = [[], []];
  let failLater = false;
  requested.forEach(function (requestedCards: string[], i: number) {
    const pool = pools[i] ?? [];
    const tmpCards: Record<string, Array<{ type: string; element: unknown; id: string }>> = {};
    for (const item of pool) {
      // add all matching cards to temporary dict
      const index = requestedCards.findIndex((elem: string) => elem == item.market_hash_name);
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
    requestedCards.forEach(function (elem: string) {
      const currentCards = tmpCards[elem] || []; // all cards from inventory with requested signature
      if (currentCards.length === 0) {
        failLater = true;
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
  return { moves, failLater, cardTypes };
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
