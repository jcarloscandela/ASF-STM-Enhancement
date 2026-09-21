// Pure gamecards-page parser, extracted from `GetCards` in `src/ASF-STM.ts`
// (openspec change modularize-userscript-services, slice 2.1).
//
// No DOM globals, XHR, `GM_*`, or storage access: the caller supplies the
// parsed document root and the user's card slots for hash/number mapping, so
// this module is unit-testable with canned documents and stays bundled
// single-file. Behavior is intentionally identical to the inline code,
// including its quirks (see notes below).

import type { MatchCard } from "./models";

/** One partner card slot as parsed from a gamecards page. */
export interface ParsedGamecard {
  item: string;
  hash: string;
  count: number;
  iconUrl: string;
  number: number;
}

export type GamecardsParseResult =
  /** At least 5 card slots and every title mapped to a user slot. */
  | { kind: "ok"; maxCards: number; cards: ParsedGamecard[] }
  /** Fewer than 5 card slots: the caller treats this as malformed/private. */
  | { kind: "too-few"; found: number }
  /** A partner card title mapped to no user slot: the badge is skipped. */
  | { kind: "unmatched"; unmatched: string };

/** Minimal structural view of the user slots needed for hash mapping. */
export interface OwnCardSlot {
  item: string;
  hash: string;
  number: number;
}

/** Minimal structural view of a badge for ordering/set-size normalization. */
export interface OrderableBadge {
  maxCards: number;
  maxSets: number;
  lastSet: number;
  cards: Array<{ count: number }>;
}

/** Sorts a badge's slots by owned copies, descending (in place). */
export function sortBadgeCardsDesc(badge: { cards: Array<{ count: number }> }): void {
  badge.cards.sort((a, b) => b.count - a.count);
}

/**
 * Whether a (descending-sorted) badge has a matchable distribution: the
 * spread between the fullest and emptiest slot reaches at least 2. A flat
 * badge (e.g. 2/2/2/2/2) has nothing to offer and nothing to need.
 */
export function hasMatchableDistribution(badge: { cards: Array<{ count: number }> }): boolean {
  return badge.cards[0]!.count - badge.cards[badge.cards.length - 1]!.count >= 2;
}

/**
 * Derives set targets from the first `maxCards` sorted slots. Returns the
 * total owned copies; assigns `maxSets`/`lastSet` on the badge.
 */
export function applyBadgeSetSizes(badge: OrderableBadge): number {
  let totalCards = 0;
  for (let j = 0; j < badge.maxCards; j++) {
    totalCards += badge.cards[j]!.count;
  }
  badge.maxSets = Math.floor(totalCards / badge.maxCards);
  badge.lastSet = Math.ceil(totalCards / badge.maxCards);
  return totalCards;
}

const TEXT_NODE = 3;

/**
 * Parses one partner `gamecards/<appid>` document.
 *
 * Mirrors the inline `GetCards` logic: quantities come from
 * `.badge_card_set_text_qty` (`innerText`, `"(0)"` when the element is
 * missing, outer parens stripped); titles come from the text nodes of
 * `.badge_card_set_title`; icons from `.gamecard` src. Partner cards map to
 * user slots by exact title first, then by suffix (`market_hash_name` values
 * embed the card name after the game prefix).
 */
export function parseGamecardsPage(root: ParentNode, ownCards: OwnCardSlot[] | MatchCard[]): GamecardsParseResult {
  const badgeCards = root.querySelectorAll(".badge_card_set_card");
  if (badgeCards.length < 5) {
    return { kind: "too-few", found: badgeCards.length };
  }
  const cards: ParsedGamecard[] = [];
  for (let i = 0; i < badgeCards.length; i++) {
    const slot = badgeCards[i]!;
    const quantityElement = slot.querySelector(".badge_card_set_text_qty");
    let quantity = quantityElement === null ? "(0)" : (quantityElement as HTMLElement).innerText.trim();
    quantity = quantity.slice(1, -1);
    let name = "";
    slot.querySelector(".badge_card_set_title")!.childNodes.forEach(function (element: ChildNode) {
      if (element.nodeType === TEXT_NODE) {
        name = name + element.textContent;
      }
    });
    name = name.trim();
    const matchedCard =
      ownCards.find((card) => card.item === name) ??
      ownCards.find((card) => name.length > 0 && card.item.endsWith(name));
    if (matchedCard === undefined) {
      return { kind: "unmatched", unmatched: name };
    }
    const icon = (slot.querySelector(".gamecard") as HTMLImageElement).src.trim();
    cards.push({
      item: name,
      hash: matchedCard.hash,
      count: Number(quantity),
      iconUrl: icon,
      number: matchedCard.number,
    });
  }
  return { kind: "ok", maxCards: badgeCards.length, cards };
}
