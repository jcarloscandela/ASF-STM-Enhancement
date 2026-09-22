// Pure trade-matching core.
//
// No DOM, XHR, `GM_*`, or `localStorage` access: the userscript injects its
// debug printer, bot flag lookup, and persistence callback, so this module is
// unit-testable with plain fixtures and stays bundled single-file.
//
// Counting semantics (openspec changes fix-matcher-tradable-counts and
// audit-badge-trade-selection): owned copies (`count`) drive the badge state
// and the need checks, so a card the user already owns is never requested;
// currently tradable copies (`tradableCount`, falling back to `count` when
// unknown) cap how many copies each slot can offer, and a slot is only
// offerable while its tradable remainder exceeds the applicable set target -
// the retained copies (one per slot for a first set, `maxSets`/`lastSet` for
// later sets) are never spent, even when further owned copies are held.

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
        // Partner retain-one (openspec change audit-badge-trade-selection):
        // a partner only gives a card while they keep at least one copy.
        // Their tradability is unknown (no tradableCount on partner badges),
        // so the owned count applies - for every partner, ANY-mode included.
        if (theirBadge.cards[j]!.count > 0 && (theirBadge.cards[j]!.tradableCount ?? theirBadge.cards[j]!.count) > 1) {
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
                (myState === 0 && myBadge.cards[k]!.tradableRemaining > myBadge.maxSets) ||
                (myState === 1 && myBadge.cards[k]!.tradableRemaining > myBadge.lastSet)
              ) {
                // Strict surplus (openspec change audit-badge-trade-selection):
                // tradable copies must exceed the applicable set target, so the
                // retained copies are never spent - held owned copies beyond
                // them do not create offer capacity.
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
 * table. Hashes missing from the table are appended so no `-1` id is ever
 * persisted (a `-1` would make `decodeURIComponent(cardNames[-1])` throw on
 * the trade page and abort the offer with nothing selected).
 */
export function resolveCardIds(items: MatchItem[], cardNames: string[]): number[] {
  const ids: number[] = [];
  for (let i = 0; i < items.length; i++) {
    for (let c = 0; c < items[i]!.cards.length; c++) {
      for (let a = 0; a < items[i]!.cards[c]!.count; a++) {
        const hash = items[i]!.cards[c]!.hash;
        let id = cardNames.indexOf(hash);
        if (id === -1) {
          id = cardNames.push(hash) - 1;
        }
        ids.push(id);
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
 */ export function buildMatchStore(
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

// ---------------------------------------------------------------------------
// Trade-offer page handoff (openspec change fix-tradeoffer-empty-selection).
//
// Pure counterparts of the trade-page block in `src/ASF-STM.ts`: resolving the
// `partner`/`match` URL params against the persisted scan params into the two
// card-name lists the offer page selects. Extracted so the contract is
// fixture-testable; the userscript calls these and only handles DOM/dialogs.
// ---------------------------------------------------------------------------

/** Persisted scan params as the trade page needs them. */
export interface TradePageStore {
  matches: Record<string, Record<string, StoredMatchCards>>;
  cardNames: string[];
  filter: Array<string | number>;
}

/**
 * Candidate storage keys for one `partner` URL value, most specific first:
 * the raw value, its truncated account id, and the twice-truncated form (in
 * case a stored key was truncated twice). The scan side keys matches by
 * truncated id while bot-mode URLs carry the full SteamID and friend-mode
 * URLs the truncated id, so the trade page must accept every form.
 */
export function tradePartnerKeyCandidates(partnerParam: string, truncate: (id: string) => string): string[] {
  const candidates = [partnerParam];
  const once = truncate(partnerParam);
  if (!candidates.includes(once)) {
    candidates.push(once);
  }
  const twice = truncate(once);
  if (!candidates.includes(twice)) {
    candidates.push(twice);
  }
  return candidates;
}

/** Finds the stored per-appid match map for one `partner` URL value. */
export function resolvePartnerMatches(
  matches: TradePageStore["matches"],
  partnerParam: string,
  truncate: (id: string) => string,
): Record<string, StoredMatchCards> {
  for (const key of tradePartnerKeyCandidates(partnerParam, truncate)) {
    const entry = matches[key];
    if (entry !== undefined) {
      return entry;
    }
  }
  throw new Error("no matches with this partner");
}

/**
 * Resolves the `match` URL value to the appid filter: `"all"` selects the
 * whole persisted filter, otherwise exactly the one numeric appid. Fixes the
 * inherited dead check (`Number(x) === NaN`, never true) by rejecting
 * non-numeric values as invalid.
 */
export function resolveTradeFilter(matchParam: string | undefined, filter: TradePageStore["filter"]): number[] {
  if (matchParam === undefined) {
    throw new Error("missing url parameter");
  }
  if (matchParam === "all") {
    return filter.map((appId) => Number(appId));
  }
  const appId = Number(matchParam);
  if (Number.isNaN(appId)) {
    throw new Error("invalid url parameter");
  }
  return [appId];
}

/** Decodes one persisted card id to its market-hash name, skipping unknowns. */
export function decodeStoredCardName(
  cardNames: string[],
  card: number,
  onSkip?: (card: number) => void,
): string | undefined {
  const name = cardNames[card];
  if (typeof name !== "string") {
    onSkip?.(card);
    return undefined;
  }
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}

/**
 * Builds the two card-name lists (ours, theirs) for the resolved appid
 * filter. Appids in the filter without a match entry are skipped (the filter
 * is the allowed set, not necessarily this partner's set). Throws when
 * nothing resolves or when the sides are unbalanced, matching the trade-page
 * abort messages.
 */
export function resolveTradeCards(
  partnerMatches: Record<string, StoredMatchCards>,
  appFilter: number[],
  cardNames: string[],
  onSkip?: (card: number) => void,
): [string[], string[]] {
  const send: string[] = [];
  const receive: string[] = [];
  for (const appId of appFilter) {
    const entry = partnerMatches[appId];
    if (entry === undefined) {
      continue;
    }
    for (const card of entry.send) {
      const name = decodeStoredCardName(cardNames, card, onSkip);
      if (name !== undefined) {
        send.push(name);
      }
    }
    for (const card of entry.receive) {
      const name = decodeStoredCardName(cardNames, card, onSkip);
      if (name !== undefined) {
        receive.push(name);
      }
    }
  }
  if (send.length !== receive.length) {
    throw new Error("Different items amount on both sides");
  }
  if (send.length === 0) {
    throw new Error("nothing to add, exiting");
  }
  return [send, receive];
}
