// Pure trade-matching core.
//
// No DOM, XHR, `GM_*`, or `localStorage` access: the userscript injects its
// debug printer, bot flag lookup, and persistence callback, so this module is
// unit-testable with plain fixtures and stays bundled single-file.
//
// Counting semantics (openspec change fix-matcher-tradable-counts): owned
// copies (`count`) drive the badge state and the need checks, so a card the
// user already owns is never requested; currently tradable copies
// (`tradableCount`, falling back to `count` when unknown) cap how many copies
// each slot can offer. This intentionally diverges from the pre-extraction
// userscript behavior for badges with trade-held copies.

import type { MatchCard, MatchBadge, MatchCardRef, MatchItem } from "./models";

export type { MatchCard, MatchBadge, MatchCardRef, MatchItem };

/** The two sides of a computed match. */
export interface MatchResult {
  itemsToSend: MatchItem[];
  itemsToReceive: MatchItem[];
}

/** Injected seams so the core stays free of host side effects. */
export interface MatchDeps {
  debugPrint: (message: unknown) => void;
  /** Whether the bot at this index accepts any-cards trades. */
  isMatchEverything: (botIndex: number) => boolean;
}

/** User-side card slot plus the per-match offer bookkeeping. */
interface WorkCard extends MatchCard {
  /** Currently tradable copies still offerable from this slot. */
  tradableRemaining: number;
}

/** User-side badge whose cards carry the offer bookkeeping. */
interface WorkBadge extends MatchBadge {
  cards: WorkCard[];
}

export function calcBadgeState(badge: MatchBadge): number {
  //state 0 - less than max sets; state 1 - we have max sets, even out the rest, state 2 - all even
  return badge.cards[badge.maxCards - 1]!.count === badge.maxSets
    ? badge.cards[0]!.count === badge.lastSet
      ? 2 //nothing to do
      : 1 //max sets are here, but we can distribute cards further
    : 0; //less than max sets
}

function accumulate(target: MatchItem[], appId: number, title: string, card: MatchCardRef): void {
  const existing = target.find((item) => item.appId == appId);
  if (existing === undefined) {
    target.push({ appId, title, cards: [card] });
    return;
  }
  const existingCard = existing.cards.find((a) => a.hash === card.hash);
  if (existingCard === undefined) {
    existing.cards.push(card);
  } else {
    existingCard.count += 1;
  }
}

/**
 * Computes the trade for every badge pair. `myBadges` and `botBadges` are not
 * mutated; the accumulator works on deep clones.
 */
export function computeMatches(
  myBadges: MatchBadge[],
  botBadges: MatchBadge[],
  botIndex: number,
  deps: MatchDeps,
): MatchResult {
  const { debugPrint, isMatchEverything } = deps;
  const itemsToSend: MatchItem[] = [];
  const itemsToReceive: MatchItem[] = [];

  for (let i = 0; i < botBadges.length; i++) {
    let myBadge = JSON.parse(JSON.stringify(myBadges[i]!)) as WorkBadge;
    let theirBadge = JSON.parse(JSON.stringify(botBadges[i]!)) as MatchBadge;
    // Owned counts (`count`) drive state and need checks; the tradable
    // remainder caps offers. Clamped by `count` so unexpected input cannot
    // offer copies the user does not own.
    for (const card of myBadge.cards) {
      card.tradableRemaining = Math.min(card.tradableCount ?? card.count, card.count);
    }
    let myState = calcBadgeState(myBadge);
    debugPrint("state=" + myState);
    debugPrint("myapp=" + myBadge.appId + " botapp=" + theirBadge.appId);
    while (myState < 2) {
      let foundMatch = false;
      for (let j = 0; j < theirBadge.maxCards; j++) {
        //index of card they give
        if (theirBadge.cards[j]!.count > 0) {
          //try to match
          let myInd = myBadge.cards.findIndex((a) => a.number === theirBadge.cards[j]!.number); //index of slot where we receive card
          if (
            (myState === 0 && myBadge.cards[myInd]!.count < myBadge.maxSets) ||
            (myState === 1 && myBadge.cards[myInd]!.count < myBadge.lastSet)
          ) {
            //we need this ^Kfor the Emperor
            debugPrint("we need this: " + theirBadge.cards[j]!.item + " (" + theirBadge.cards[j]!.count + ")");
            //find a card to match.
            for (let k = 0; k < myInd; k++) {
              //index of card we give
              debugPrint("i=" + i + " j=" + j + " k=" + k + " myState=" + myState);
              debugPrint("we have this: " + myBadge.cards[k]!.item + " (" + myBadge.cards[k]!.count + ")");
              if (
                ((myState === 0 && myBadge.cards[k]!.count > myBadge.maxSets) ||
                  (myState === 1 && myBadge.cards[k]!.count > myBadge.lastSet)) &&
                myBadge.cards[k]!.tradableRemaining > 0
              ) {
                //that's fine for us
                debugPrint("it's a good trade for us");
                let theirInd = theirBadge.cards.findIndex((a) => a.number === myBadge.cards[k]!.number); //index of slot where they will receive card
                if (!isMatchEverything(botIndex)) {
                  //make sure it's neutral+ for them
                  if (theirBadge.cards[theirInd]!.count >= theirBadge.cards[j]!.count) {
                    debugPrint("Not fair for them");
                    debugPrint(
                      "they have this: " +
                        theirBadge.cards[theirInd]!.item +
                        " (" +
                        theirBadge.cards[theirInd]!.count +
                        ")",
                    );
                    continue; //it's not neutral+, check other options
                  }
                }
                debugPrint("it's a match!");
                const itemToSend: MatchCardRef = {
                  item: myBadge.cards[k]!.item,
                  count: 1,
                  iconUrl: myBadge.cards[k]!.iconUrl,
                  hash: myBadge.cards[k]!.hash,
                };
                const itemToReceive: MatchCardRef = {
                  item: theirBadge.cards[j]!.item,
                  count: 1,
                  iconUrl: theirBadge.cards[j]!.iconUrl,
                  hash: theirBadge.cards[j]!.hash,
                };
                //fill items to send
                accumulate(itemsToSend, myBadge.appId, myBadge.title, itemToSend);
                //add this item to their inventory
                theirBadge.cards[theirInd]!.count += 1;
                //remove this item from our inventory (owned) and from the
                //offerable remainder (one tradable copy committed)
                myBadge.cards[k]!.count -= 1;
                myBadge.cards[k]!.tradableRemaining -= 1;

                //fill items to receive
                accumulate(itemsToReceive, myBadge.appId, myBadge.title, itemToReceive);
                //add this item to our inventory; a received copy is tradable,
                //so the offerable remainder moves with the owned count
                myBadge.cards[myInd]!.count += 1;
                myBadge.cards[myInd]!.tradableRemaining += 1;
                //remove this item from their inventory
                theirBadge.cards[j]!.count -= 1;
                foundMatch = true;
                break; //found a match!
              }
            }
          }
          if (foundMatch) {
            //if we found something - we need to sort cards again and start over.
            myBadge.cards.sort((a, b) => b.count - a.count);
            myState = calcBadgeState(myBadge);
            debugPrint("new myState=" + myState);
          }
        }
      }
      if (!foundMatch) {
        break; //found no matches - move to next badge
      }
      theirBadge.cards.sort((a, b) => b.count - a.count);
    }
  }

  return { itemsToSend, itemsToReceive };
}

/**
 * Resolves every accumulated card hash to its index in the shared card-name
 * table. Missing hashes stay `-1`, exactly as the original `indexOf` did.
 */
export function resolveCardIds(items: MatchItem[], cardNames: string[]): number[] {
  const ids: number[] = [];
  for (let i = 0; i < items.length; i++) {
    for (let c = 0; c < items[i]!.cards.length; c++) {
      for (let a = 0; a < items[i]!.cards[c]!.count; a++) {
        ids.push(cardNames.indexOf(items[i]!.cards[c]!.hash));
      }
    }
  }
  return ids;
}

/** One game's send/receive card-id lists, as persisted for the trade page. */
export interface StoredMatchCards {
  send: number[];
  receive: number[];
}

/**
 * Builds the persisted per-partner match map from the two trade sides.
 * Throws when the sides disagree, matching the original behavior.
 */
export function buildMatchStore(
  itemsToSend: MatchItem[],
  itemsToReceive: MatchItem[],
  cardNames: string[],
): Record<string, StoredMatchCards> {
  const partnerMatches: Record<string, StoredMatchCards> = {};

  for (const item of itemsToSend) {
    if (partnerMatches[item.appId] === undefined) {
      partnerMatches[item.appId] = { send: [], receive: [] };
    }
    partnerMatches[item.appId]!.send.push(...resolveCardIds([item], cardNames));
  }

  for (const item of itemsToReceive) {
    if (partnerMatches[item.appId] === undefined) {
      throw new Error("Sent and received appIDs don't match!");
    }
    partnerMatches[item.appId]!.receive.push(...resolveCardIds([item], cardNames));
    if (partnerMatches[item.appId]!.send.length !== partnerMatches[item.appId]!.receive.length) {
      throw new Error("Sent and received card count don't match for " + partnerMatches[item.appId] + " !");
    }
  }

  return partnerMatches;
}
