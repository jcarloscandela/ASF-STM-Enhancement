// Pure trade-matching core.
//
// No DOM, XHR, `GM_*`, or `localStorage` access: the userscript injects its
// debug printer, bot flag lookup, and persistence callback, so this module is
// unit-testable with plain fixtures and stays bundled single-file.
//
// Counting semantics (openspec change fix-blocked-tradable-offer-sizing):
// owned copies (`count`) drive the badge state and the need checks, so a card
// the user already owns is never requested; the give check retains owned
// copies and caps at tradable ones - a slot is offerable only while it owns
// more than the applicable set target (`count`) AND holds at least one
// currently tradable copy (`tradableRemaining`), i.e. the offerable surplus
// is `max(min(tradable, owned - target), 0)`. The retained owned copies (one
// per slot for a first set, `maxSets`/`lastSet` for later sets) are never
// spent, while a tradable copy above them is offerable even when every other
// owned copy is held.

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
        // Partner give condition (openspec change selfish-trade-matching):
        // ANY-mode partners are pure card sources - ownership alone suffices,
        // even their last copy. Fair partners keep the retain-one rule: they
        // only give a card while they keep at least one copy. Their
        // tradability is unknown (no tradableCount on partner badges), so the
        // owned count applies to the retain term.
        const partnerGives = theirBadge.cards[j]!;
        const partnerCanGive = isMatchEverything(botIndex)
          ? partnerGives.count > 0
          : partnerGives.count > 0 && (partnerGives.tradableCount ?? partnerGives.count) > 1;
        if (partnerCanGive) {
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
                (myState === 0 &&
                  myBadge.cards[k]!.count > myBadge.maxSets &&
                  myBadge.cards[k]!.tradableRemaining > 0) ||
                (myState === 1 && myBadge.cards[k]!.count > myBadge.lastSet && myBadge.cards[k]!.tradableRemaining > 0)
              ) {
                // Retained-owned surplus (openspec change
                // fix-blocked-tradable-offer-sizing): the slot must own more
                // than the applicable set target (the retained owned copies
                // are never spent) and still hold a currently-tradable copy
                // to send - held owned copies beyond the retained count keep
                // set progress but never create offer capacity by themselves.
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

// ---------------------------------------------------------------------------
// Empty-offer diagnosis (openspec change fix-empty-trade-offer-selection).
//
// Best-effort, never-throwing snapshot of why a trade-setup abort left both
// sides empty. Computed at offer time only; never persisted. The trade page
// formats it into the `trade setup` dialog alongside the Params-key pointer.
// ---------------------------------------------------------------------------

/** Structured cause snapshot for one `trade setup` (handoff-data) abort. */
export interface TradeHandoffDiagnosis {
  /** Fixed stage label separating handoff-data failures from live-inventory ones. */
  stage: "trade setup";
  /** Original abort message (`missing url parameter`, `no matches ...`, ...). */
  cause: string;
  /** Partner storage keys tried, most specific first. */
  partnerKeysTried: string[];
  /** Resolved appid filter, or [] when `match` itself was invalid. */
  resolvedFilter: number[];
  /** Filter appids that had a match entry for this partner. */
  matchedAppids: number[];
  /** Filter appids with no match entry for this partner. */
  missingAppids: number[];
  /** Stored card ids that decoded to no market-hash name. */
  skippedCardIds: number[];
  /** Decodable send/receive card counts after skipping unknowns. */
  sendCount: number;
  receiveCount: number;
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

function safePartnerKeys(partnerParam: string, truncate: (id: string) => string): string[] {
  try {
    return tradePartnerKeyCandidates(partnerParam, truncate);
  } catch {
    return [partnerParam];
  }
}

/**
 * Snapshots a `trade setup` abort without throwing. Every step is guarded so
 * a corrupt store still yields counts instead of a second exception: an
 * unresolvable `match` param gives an empty filter, an unknown partner gives
 * no match map, and unknown card ids are counted as skipped.
 */
export function diagnoseTradeHandoff(args: {
  partnerParam: string;
  truncate: (id: string) => string;
  matchParam: string | undefined;
  filter: TradePageStore["filter"];
  matches: TradePageStore["matches"];
  cardNames: string[];
  cause: unknown;
}): TradeHandoffDiagnosis {
  const { partnerParam, truncate, matchParam, filter, matches, cardNames, cause } = args;
  const partnerKeysTried = safePartnerKeys(partnerParam, truncate);
  let resolvedFilter: number[] = [];
  try {
    resolvedFilter = resolveTradeFilter(matchParam, filter);
  } catch {
    resolvedFilter = [];
  }
  let partnerMatches: Record<string, StoredMatchCards> | undefined;
  try {
    partnerMatches = resolvePartnerMatches(matches, partnerParam, truncate);
  } catch {
    partnerMatches = undefined;
  }
  const matchedAppids: number[] = [];
  const missingAppids: number[] = [];
  const skippedCardIds: number[] = [];
  let sendCount = 0;
  let receiveCount = 0;
  if (partnerMatches !== undefined) {
    for (const appId of resolvedFilter) {
      const entry = partnerMatches[appId];
      if (entry === undefined) {
        missingAppids.push(appId);
        continue;
      }
      matchedAppids.push(appId);
      for (const card of entry.send) {
        if (decodeStoredCardName(cardNames, card) === undefined) {
          skippedCardIds.push(card);
        } else {
          sendCount += 1;
        }
      }
      for (const card of entry.receive) {
        if (decodeStoredCardName(cardNames, card) === undefined) {
          skippedCardIds.push(card);
        } else {
          receiveCount += 1;
        }
      }
    }
  } else {
    for (const appId of resolvedFilter) {
      missingAppids.push(appId);
    }
  }
  return {
    stage: "trade setup",
    cause: errorMessage(cause),
    partnerKeysTried,
    resolvedFilter,
    matchedAppids,
    missingAppids,
    skippedCardIds,
    sendCount,
    receiveCount,
  };
}

function cappedList(values: number[], cap = 10): string {
  if (values.length === 0) {
    return "none";
  }
  const shown = values.slice(0, cap).join(", ");
  return values.length > cap ? `${shown} (+${values.length - cap} more)` : shown;
}

/**
 * Renders the visible `trade setup` dialog body: one-line cause plus the
 * counts needed to act (rescan vs stale Params vs bug report), capped lists
 * with the remainder in the debug log, the Params-key pointer, and the
 * explicit empty-offer sentence. Pure, so harness tests can assert it.
 */
export function formatTradeSetupMessage(diagnosis: TradeHandoffDiagnosis, cap = 10): string {
  const lines = [
    `Stage: ${diagnosis.stage} (${diagnosis.cause}).`,
    `Partner keys tried: ${diagnosis.partnerKeysTried.join(", ") || "none"}.`,
    `Filter appids: ${cappedList(diagnosis.resolvedFilter, cap)} ` +
      `(${diagnosis.matchedAppids.length} with matches, ${diagnosis.missingAppids.length} without).`,
    `Missing appids: ${cappedList(diagnosis.missingAppids, cap)}.`,
    `Skipped unknown card ids: ${diagnosis.skippedCardIds.length}.`,
    `Cards: ${diagnosis.sendCount} to send / ${diagnosis.receiveCount} to receive.`,
    "No items were added. Open DevTools console and check localStorage key",
    "TempAsfStm.ASF.STM.Params (matches/filter/cardNames).",
  ];
  return lines.join("\n");
}
