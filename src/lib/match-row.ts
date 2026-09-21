// Pure match-row view-data builders, extracted from `addMatchRow` in
// `src/ASF-STM.ts` (openspec change modularize-userscript-services, slice 2.4).
//
// No DOM, XHR, `GM_*`, or storage access: the userscript keeps the widget
// manipulation and persistence calls, and these functions decide what the
// DOM/persistence layer should do. Behavior is intentionally identical to
// the inline code.

import type { MatchItem } from "./models";
import { getPartner } from "./helpers";

/** Sorts trade sides by game name, mirroring the inline `compareNames`. */
export function compareMatchNames(a: MatchItem, b: MatchItem): number {
  const nameA = a.title;
  const nameB = b.title;
  if (nameA < nameB) {
    return -1;
  }
  if (nameA > nameB) {
    return 1;
  }
  return 0;
}

/**
 * Builds the partner base trade URL (before `&match=`): friend mode uses the
 * full SteamID with no token, bot mode the truncated account id plus token.
 */
export function buildTradeBaseUrl(
  matchFriends: boolean,
  steamId: string,
  tradeToken: string | null | undefined,
): string {
  let tradeUrl = "https://steamcommunity.com/tradeoffer/new/?partner=";
  if (matchFriends) {
    tradeUrl += `${steamId}&source=asfstm`;
  } else {
    tradeUrl += `${getPartner(steamId)}&token=${tradeToken}&source=asfstm`;
  }
  return tradeUrl;
}

/** Outcome of reconciling one badge against the persisted filter widget. */
export interface FilterUpdate {
  /** Row display for this badge (`none` when its filter box is unchecked). */
  display: string;
  /** True when the appid must be appended to the persisted filter. */
  addedToFilter: boolean;
}

/**
 * Pure decision behind the per-badge filter widget update: a missing checkbox
 * means a new filter entry (row visible); an existing one only hides the row
 * when unchecked.
 */
export function planFilterUpdate(checkboxExists: boolean, checkboxChecked: boolean): FilterUpdate {
  if (!checkboxExists) {
    return { display: "inline-block", addedToFilter: true };
  }
  return { display: checkboxChecked ? "inline-block" : "none", addedToFilter: false };
}

/** Null avatar hashes fall back to the shared default, as inline. */
export function defaultBotAvatarHash(avatarHash: string | null): string {
  return avatarHash === null ? "fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb" : avatarHash;
}

/** Renders one trade side as showcase slots, mirroring `populateCards`. */
export function populateCardsHtml(item: MatchItem): string {
  let htmlCards = "";
  for (let j = 0; j < item.cards.length; j++) {
    const itemIcon = item.cards[j]!.iconUrl;
    const itemName = item.cards[j]!.item;
    for (let k = 0; k < item.cards[j]!.count; k++) {
      const cardTemplate = `
                    <div class="showcase_slot">
                        <img class="image-container" src="${itemIcon}/98x115">
                        <div class="commentthread_subscribe_hint" style="width: 98px;">${itemName}</div>
                    </div>
                `;
      htmlCards += cardTemplate.replaceAll(/(  |\n)/g, "");
    }
  }
  return htmlCards;
}
