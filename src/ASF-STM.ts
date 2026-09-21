// ASF STM Enhancement userscript source (TypeScript).
//
// Bundled by rolldown into the single self-contained dist/ASF-STM.user.js.
// The Tampermonkey metadata block is prepended by the bundler banner config.

import css from "./templates/css.css";
import { renderConfigDialog } from "./templates/configDialogTemplate";
import { renderMainContent } from "./templates/mainContentTemplate";
import { renderMatch } from "./templates/matchTemplate";
import { renderRow } from "./templates/rowTemplate";
import { loadSettings, resetSettings, resolveScanPlan, saveSettings } from "./lib/settings";
import type { ScanPlan } from "./lib/settings";
import { parseInventoryAsset, parseInventoryDescription } from "./lib/steam-schema";
import { buildMatchStore, computeMatches } from "./lib/matcher-core";
import { buildInventoryCardCounts, buildScanEligibility, isTradeOfferItemTradable } from "./lib/tradable";
import {
  arrayToText,
  deepClone,
  getPartner,
  hexToRgba,
  mixAlpha,
  rgbaToHex,
  sanitizeNickname,
  textToArray,
} from "./lib/helpers";
import { readJson, STORAGE_KEYS, writeJson } from "./lib/storage";
import { gmGet, resolveRequestFunction, retryDelay } from "./lib/requests";
import type { GmRequestFunction, GmRequestResponse, ModernGmApi } from "./lib/requests";
import type {
  Badge,
  BadgeCardInfo,
  BotEntry,
  BotsResponse,
  InventoryCardCounts,
  InventoryData,
  MatchCard,
  MatchItem,
  ProgressRadials,
  TradeParams,
  UserSettings,
} from "./lib/models";

// Tampermonkey / Greasemonkey globals provided by the userscript host.
declare const GM_xmlhttpRequest: GmRequestFunction | undefined;
declare const GM_addStyle: ((css: string) => void) | undefined;
declare const GM_info: { version: string };
declare const GM: ModernGmApi;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const unsafeWindow: any;

(function () {
  "use strict";

  let myProfileLink = "";
  let errors = 0;
  let bots: BotsResponse | null = null;
  let myBadges: Badge[] = [];
  let botBadges: Badge[] = [];
  let inventoryCardCounts: InventoryCardCounts | null = null;
  let scanRunId = 0;
  let stop = false;
  let botCacheTime = 5 * 60000;
  let globalSettings!: UserSettings;
  let blacklist: string[] = [];
  let progressRadials: ProgressRadials = {
    scanPages: { currentStep: 0, steps: 0, radialElement: null, textElement: null },
    badges: { currentStep: 0, steps: 0, radialElement: null, textElement: null },
    bots: { currentStep: 0, steps: 0, radialElement: null, textElement: null },
    botBadges: { currentStep: 0, steps: 0, radialElement: null, textElement: null },
  };
  let defaultSettings: UserSettings = {
    matchFriends: false,
    inventoryScanDelay: 3000,
    anyBots: true,
    fairBots: true,
    sortByName: true,
    sortBotsBy: [
      "MatchEverythingFirst",
      "TotalGamesCountDesc",
      "TotalItemsCountDesc",
      "TotalInventoryCountAsc",
      "None",
    ],
    botMinItems: 0,
    botMaxItems: 0,
    weblimiter: 300,
    errorLimiter: 30000,
    debug: false,
    maxErrors: 3,
    filterBackgroundColor: "rgba(23,26,33,0.8)",
    preventClose: true,
    // for trade offer
    tradeMessage: "ASF STM Matcher",
    autoSend: false,
    doAfterTrade: "NOTHING",
    order: "AS_IS",
    // scan filters
    useScanFilters: false,
    scanFilters: [],
    autoAddScanFilters: true,
    autoDeleteScanFilters: true,
  };
  let cardNames = new Set<string>();
  let tradeParams: TradeParams = {
    matches: {},
    filter: [],
  };
  /* Mutation observer for filter counting */
  const observer = new MutationObserver((mutationList, _observer) => {
    for (const mutation of mutationList) {
      if (mutation.type === "attributes" && mutation.attributeName === "data-count") {
        ((mutation.target as Element).querySelector("b") as HTMLElement).innerText =
          `(${(mutation.target as HTMLElement).dataset.count})`;
      }
    }
  });

  //styles (css arrives as a text-module import at the top of this file)

  function debugTime(name: string): void {
    if (globalSettings.debug) {
      console.time(name);
    }
  }
  function debugTimeEnd(name: string): void {
    if (globalSettings.debug) {
      console.timeEnd(name);
    }
  }
  function debugPrint(msg: unknown): void {
    if (globalSettings.debug) {
      console.log(
        new Date().toLocaleTimeString("en-GB", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          fractionalSecondDigits: 3,
        }) +
          " : " +
          msg,
      );
    }
  }
  function createScanFilterElement(active: boolean, appId: string | number, gameName: string): string {
    return `
            <div id="scan-filter-${appId}" class="friendBlock" style="cursor: auto;">
                <div class="playerAvatar ${active ? "ingame" : "offline"}">
                    <a target="_blank" rel="noopener noreferrer" href="https://steamcommunity.com/${myProfileLink}/gamecards/${appId}/">
                        <img class="stretch" src="https://steamcdn-a.akamaihd.net/steam/apps/${appId}/capsule_184x69.jpg">
                    </a>
                </div>
                <div id="scan-filter-name-${appId}" class="friendBlockContent">${gameName}<br>
                    <input type="checkbox" data-app-id="${appId}" ${active ? "checked" : ""}>
                </div>
            </div>
        `.replaceAll(/(  |\n)/g, "");
  }

  function ShowConfigDialog() {
    let filterBG = rgbaToHex(globalSettings.filterBackgroundColor, debugPrint);
    const questionmarkURL = "https://store.cloudflare.steamstatic.com/public/shared/images/ico/icon_questionmark.png";
    const options = [
      { value: "MatchEverythingFirst", text: '"Any" bots first' },
      { value: "MatchEverythingLast", text: '"Any" bots last' },
      { value: "TotalGamesCountDesc", text: "Total games count, descending" },
      { value: "TotalGamesCountAsc", text: "Total games count, ascending" },
      { value: "TotalItemsCountDesc", text: "Total matchable items count, descending" },
      { value: "TotalItemsCountAsc", text: "Total matchable items count, ascending" },
      { value: "TotalInventoryCountDesc", text: "Total inventory count, descending" },
      { value: "TotalInventoryCountAsc", text: "Total inventory count, ascending" },
      { value: "None", text: "None" },
    ];

    function createSortSelect(idx: number): string {
      return `
            <div>
                <span style="width: 80px; display: inline-block;">
                    ${idx === 0 ? "Sort bots by:" : "…then by:"}
                </span>
                <select class="asf-stm-select" id="sortBotsBy${idx}">
                    ${options
                      .map(
                        ({ value, text }) =>
                          `<option value="${value}" ${globalSettings.sortBotsBy[idx] === value ? "selected" : ""}>${text}</option>`,
                      )
                      .join("")}
                </select>
            </div>`.replaceAll(/(  |\n)/g, "");
    }

    globalSettings.scanFilters.sort((x, y) =>
      x.title < y.title ? -1 : x.title > y.title ? 1 : (x.appid as number) - (y.appid as number),
    ); // FIXME Add try catch on read and reset settings
    const scanFiltersTemplate = globalSettings.scanFilters
      .map((x) => createScanFilterElement(x.active, x.appId, x.title))
      .join("");

    const sortSelectsHtml = Array.from({ length: 4 }, (_, i) => createSortSelect(i)).join("");
    const blacklistText = arrayToText(blacklist);
    const configDialogTemplate = renderConfigDialog(
      globalSettings,
      filterBG,
      questionmarkURL,
      sortSelectsHtml,
      blacklistText,
      scanFiltersTemplate,
    );
    let templateElement = document.createElement("template");
    templateElement.innerHTML = configDialogTemplate;
    let configDialog = templateElement.content.firstElementChild as Element;

    configDialog.querySelector("#addScanFilterButton")!.addEventListener("click", addScanFilterEventHandler, false);
    configDialog.querySelector("#clearScanFilters")!.addEventListener("click", clearScanFiltersEventHandler, false);

    unsafeWindow.ShowConfirmDialog("ASF STM Configuration", configDialog, "Save", "Cancel", "Reset").done(function (
      button: string,
    ) {
      if (button === "OK") {
        const dialog = configDialog as HTMLElement;
        globalSettings.matchFriends = (dialog.querySelector("#matchFriends") as HTMLInputElement).checked;
        globalSettings.anyBots = (dialog.querySelector("#anyBots") as HTMLInputElement).checked;
        globalSettings.fairBots = (dialog.querySelector("#fairBots") as HTMLInputElement).checked;
        globalSettings.sortByName = (dialog.querySelector("#sortByName") as HTMLInputElement).checked;
        let newsortBotsBy: string[] = [];
        dialog.querySelectorAll("[id^=sortBotsBy").forEach(function (elem: Element) {
          newsortBotsBy.push((elem as HTMLSelectElement).selectedOptions[0]!.value);
        });
        globalSettings.sortBotsBy = newsortBotsBy;
        let newbotMinItems = Number((dialog.querySelector("#botMinItems") as HTMLInputElement).value);
        globalSettings.botMinItems = isNaN(newbotMinItems) ? globalSettings.botMinItems : newbotMinItems;
        let newbotMaxItems = Number((dialog.querySelector("#botMaxItems") as HTMLInputElement).value);
        globalSettings.botMaxItems = isNaN(newbotMaxItems) ? globalSettings.botMaxItems : newbotMaxItems;
        let newweblimiter = Number((dialog.querySelector("#weblimiter") as HTMLInputElement).value);
        globalSettings.weblimiter = isNaN(newweblimiter) ? globalSettings.weblimiter : newweblimiter;
        let newerrorLimiter = Number((dialog.querySelector("#errorLimiter") as HTMLInputElement).value);
        globalSettings.errorLimiter = isNaN(newerrorLimiter) ? globalSettings.errorLimiter : newerrorLimiter;
        globalSettings.debug = (dialog.querySelector("#debug") as HTMLInputElement).checked;
        let newmaxErrors = Number((dialog.querySelector("#maxErrors") as HTMLInputElement).value);
        globalSettings.maxErrors = isNaN(newmaxErrors) ? globalSettings.maxErrors : newmaxErrors;
        let newinventoryScanDelay = Number((dialog.querySelector("#inventoryScanDelay") as HTMLInputElement).value);
        globalSettings.inventoryScanDelay = isNaN(newinventoryScanDelay)
          ? globalSettings.inventoryScanDelay
          : newinventoryScanDelay;
        globalSettings.filterBackgroundColor = mixAlpha(
          hexToRgba((dialog.querySelector("#filterBackgroundColor") as HTMLInputElement).value),
          (dialog.querySelector("#filterBackgroundAlpha") as HTMLInputElement).value,
          debugPrint,
        );
        globalSettings.preventClose = (dialog.querySelector("#preventClose") as HTMLInputElement).checked;
        globalSettings.tradeMessage = (dialog.querySelector("#tradeMessage") as HTMLInputElement).value;
        globalSettings.autoSend = (dialog.querySelector("#autoSend") as HTMLInputElement).checked;
        globalSettings.doAfterTrade = (
          dialog.querySelector("#doAfterTrade") as HTMLSelectElement
        ).selectedOptions[0]!.value;
        globalSettings.order = (dialog.querySelector("#order") as HTMLSelectElement).selectedOptions[0]!.value;
        globalSettings.useScanFilters = (dialog.querySelector("#useScanFilters") as HTMLInputElement).checked;
        globalSettings.autoAddScanFilters = (dialog.querySelector("#autoAddScanFilters") as HTMLInputElement).checked;
        globalSettings.autoDeleteScanFilters = (
          dialog.querySelector("#autoDeleteScanFilters") as HTMLInputElement
        ).checked;
        let filters = Object.fromEntries(
          Array.from(dialog.querySelectorAll("input[data-app-id]"), (x) => [
            (x as HTMLElement).dataset.appId as string,
            (x as HTMLInputElement).checked,
          ]),
        );
        globalSettings.scanFilters.forEach((x) => {
          x.active = filters[x.appId] ?? false;
        });
        blacklist = textToArray((dialog.querySelector("#blacklist") as HTMLInputElement).value);
        SaveConfig();
      } else {
        unsafeWindow
          .ShowConfirmDialog("CONFIRMATION", "Are you sure you want to restore default settings?")
          .done(function () {
            ResetConfig();
            SaveConfig();
          });
      }
    });
  }

  function ResetConfig() {
    // Clears the persisted settings (all four keys per the storage spec) and
    // restores in-memory defaults. BREAKING vs earlier behavior: the blacklist
    // no longer survives reset — the spec requires reset to clear everything.
    globalSettings = resetSettings(localStorage, defaultSettings) as unknown as UserSettings;
  }

  function SaveConfig() {
    // Atomic save: one JSON document per key, written only after the dialog
    // handler has fully applied the new values.
    saveSettings(localStorage, globalSettings);
    writeJson(localStorage, STORAGE_KEYS.blacklist, blacklist);
  }

  function LoadConfig(): void {
    // Loads via the versioned settings store: merge stored over defaults so a
    // saved option survives reloads, missing keys
    // backfill, wrong-typed values fall back per key, and missing/corrupt
    // storage yields a fresh copy of the defaults. Reads never throw.
    globalSettings = loadSettings(localStorage, defaultSettings) as unknown as UserSettings;
    blacklist = readJson<string[]>(localStorage, STORAGE_KEYS.blacklist, []);
  }

  function SaveParams() {
    if (tradeParams.cardNames === undefined) {
      tradeParams.cardNames = Array.from(cardNames);
    }
    debugPrint(JSON.stringify(tradeParams.filter));
    writeJson(localStorage, STORAGE_KEYS.params, tradeParams);
  }

  function LoadParams(): unknown {
    return readJson<unknown>(localStorage, STORAGE_KEYS.params, null);
  }

  function AddScanFilter(appId: string): { success: boolean; message: string } {
    if (Number(appId) <= 0) {
      return { success: false, message: "Invalid AppID" };
    }
    if (globalSettings.scanFilters.findIndex((x) => x.appId == appId) != -1) {
      return { success: false, message: "Filter exists" };
    }
    globalSettings.scanFilters.push({ appId: appId, title: appId, active: true });
    return { success: true, message: "Added" };
  }

  function ResetScanFilters() {
    globalSettings.scanFilters = [];
  }

  function enableButton(): void {
    let buttonDiv = document.getElementById("asf_stm_button_div") as HTMLElement;
    buttonDiv.setAttribute("class", "profile_small_header_additional");
    buttonDiv.setAttribute("title", "Scan ASF STM");
    let button = document.getElementById("asf_stm_button") as HTMLElement;
    button.addEventListener("click", buttonPressedEvent, false);
  }

  function disableButton(): void {
    let buttonDiv = document.getElementById("asf_stm_button_div") as HTMLElement;
    buttonDiv.setAttribute("class", "profile_small_header_additional btn_disabled");
    buttonDiv.setAttribute("title", "Scan is in process");
    let button = document.getElementById("asf_stm_button") as HTMLElement;
    button.removeEventListener("click", buttonPressedEvent, false);
  }

  function updateProgress(radial: keyof ProgressRadials): void {
    progressRadials[radial].currentStep++;
    const totalSteps = progressRadials[radial].steps;
    const ratio = progressRadials[radial].currentStep / totalSteps;
    const degrees = ratio * 360;

    progressRadials[radial].radialElement!.style.setProperty("--progress", `${degrees}deg`);
    if (progressRadials[radial].currentStep >= totalSteps) {
      progressRadials[radial].textElement!.textContent = "✓";
    } else {
      progressRadials[radial].textElement!.textContent = `${progressRadials[radial].currentStep} / ${totalSteps}`;
    }
  }

  function getFirstRadialName(plan: ScanPlan): string {
    if (plan.mode === "filters") {
      return "Filters";
    }
    return "Inventory Pages";
  }

  function blacklistEventHandler(event: Event): void {
    let steamID = (event.currentTarget as HTMLElement).id.split("_")[1] ?? "";
    if (blacklist.includes(steamID)) {
      return;
    }

    unsafeWindow
      .ShowConfirmDialog("CONFIRMATION", `Are you sure you want to blacklist bot ${steamID} ?`)
      .done(function () {
        blacklist.push(steamID);
        SaveConfig();
      });
  }

  function filterAllEventHandler(event: Event): void {
    let appIds = ((event.target as HTMLElement).dataset.appids as string).split(",");
    appIds = appIds.map((id) => "astm_" + id);
    for (let appId of appIds) {
      let target = document.querySelector("#" + appId) as HTMLInputElement | null;
      if (target && target.checked) {
        target.click();
      }
    }
  }

  function populateCards(item: MatchItem): string {
    let htmlCards = "";
    for (let j = 0; j < item.cards.length; j++) {
      let itemIcon = item.cards[j]!.iconUrl;
      let itemName = item.cards[j]!.item;
      for (let k = 0; k < item.cards[j]!.count; k++) {
        let cardTemplate = `
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

  function checkRow(row: HTMLElement): void {
    debugPrint("checkRow");
    let matches = row.getElementsByClassName("badge_row");
    let visible = false;
    for (let i = 0; i < matches.length; i++) {
      if (matches[i]!.parentElement!.style.display !== "none") {
        visible = true;
        break;
      }
    }
    if (visible) {
      row.style.display = "block";
    } else {
      row.style.display = "none";
    }
  }

  function addMatchRow(index: number): void {
    debugPrint("addMatchRow " + index);
    let itemsToSend = bots!.Result[index]!.itemsToSend!;
    let itemsToReceive = bots!.Result[index]!.itemsToReceive!;

    // sort by game name
    function compareNames(a: MatchItem, b: MatchItem): number {
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

    if (globalSettings.sortByName) {
      itemsToSend.sort(compareNames);
      itemsToReceive.sort(compareNames);
    }

    let tradeUrl = "https://steamcommunity.com/tradeoffer/new/?partner=";
    if (globalSettings.matchFriends) {
      tradeUrl += `${bots!.Result[index]!.SteamID}&source=asfstm`;
    } else {
      tradeUrl += `${getPartner(bots!.Result[index]!.SteamID)}&token=${bots!.Result[index]!.TradeToken}&source=asfstm`;
    }
    debugPrint(tradeUrl);

    let botProfileLink = globalSettings.matchFriends
      ? `${bots!.Result[index]!.SteamIDText}`
      : `profiles/${bots!.Result[index]!.SteamID}`;
    let matches = "";
    let any = "";
    const appIdList: Array<string | number> = [];
    if (bots!.Result[index]!.MatchEverything) {
      any = `&nbsp;<sup><span class="avatar_block_status_in-game" style="font-size: 8px; cursor:help" title="This bots trades for any cards within same set">&nbsp;ANY&nbsp;</span></sup>`;
    }
    for (let i = 0; i < itemsToSend.length; i++) {
      let appId = itemsToSend[i]!.appId;
      appIdList.push(appId);
      let itemToReceive = itemsToReceive.find((a) => a.appId == appId);
      let gameName = itemsToSend[i]!.title;
      let display = "inline-block";

      //remove placeholder
      let filterWidget = document.getElementById("asf_stm_filters_body") as HTMLElement;
      let placeholder = document.getElementById("asf_stm_placeholder");
      if (placeholder !== null) {
        placeholder.parentNode!.removeChild(placeholder);
      }
      //add filter
      let checkBox = document.getElementById("astm_" + appId) as HTMLInputElement | null;
      if (checkBox === null) {
        let newFilter = `<span style="margin-right: 15px; white-space: nowrap; display: inline-block;"><input type="checkbox" id="astm_${appId}" checked="" /><label for="astm_${appId}" data-count="1">${gameName} <b>(1)</b></label></span>`;
        let spanTemplate = document.createElement("template");
        spanTemplate.innerHTML = newFilter.trim();
        filterWidget.appendChild(spanTemplate.content.firstChild!);
        tradeParams.filter.push(Number(appId));
        SaveParams();
      } else {
        /* Increment match count */
        const label = checkBox.parentElement!.querySelector("label") as HTMLElement;
        label.dataset.count = String(parseInt(label.dataset.count ?? "") + 1);
        if (checkBox.checked === false) {
          display = "none";
        }
      }

      let sendResult = populateCards(itemsToSend[i]!);
      let receiveResult = populateCards(itemToReceive!);

      let tradeUrlApp = tradeUrl + "&match=" + appId;

      const botNickname = sanitizeNickname(bots!.Result[index]!.Nickname);
      let matchTemplate = renderMatch({
        appId,
        display,
        myProfileLink,
        gameName,
        tradeUrlApp,
        sendResult,
        botProfileLink,
        botNickname,
        receiveResult,
      });
      matches += matchTemplate;
    }
    let tradeUrlFull = tradeUrl + "&match=all";
    const botEntry = bots!.Result[index]!;
    const rowAvatarHash =
      botEntry.AvatarHash === null ? "fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb" : botEntry.AvatarHash;
    const rowNickname = sanitizeNickname(botEntry.Nickname);
    let rowTemplate = renderRow({
      index,
      appIdList,
      tradeUrlFull,
      botProfileLink,
      botAvatarHash: rowAvatarHash,
      botNickname: rowNickname,
      any,
      botTotalInventoryCount: botEntry.TotalInventoryCount,
      botSteamId: botEntry.SteamID,
      matches,
    });
    let template = document.createElement("template");
    template.innerHTML = rowTemplate.trim();
    let mainContentDiv = document.getElementsByClassName("maincontent")[0] as HTMLElement;
    let newChild = template.content.firstElementChild as HTMLElement;
    newChild
      .querySelector(`#blacklist_${bots!.Result[index]!.SteamID}`)!
      .addEventListener("click", blacklistEventHandler, true);
    newChild.querySelector(".filter_all")!.addEventListener("click", filterAllEventHandler);
    mainContentDiv.appendChild(newChild);
    checkRow(newChild);
  }

  // Matching is implemented in ./lib/matcher-core; these wrappers only adapt
  // the userscript's host state (bot flags, card-name table, persistence).
  function compareCards(index: number, callback: () => void): void {
    debugPrint("bot's cards");
    debugPrint(JSON.stringify(botBadges));
    debugPrint("our cards");
    debugPrint(JSON.stringify(myBadges));

    const result = computeMatches(myBadges, botBadges, index, {
      debugPrint,
      isMatchEverything: (botIndex) => Boolean(bots!.Result[botIndex]!.MatchEverything),
    });

    debugPrint("items to send");
    debugPrint(JSON.stringify(result.itemsToSend));
    debugPrint("items to receive");
    debugPrint(JSON.stringify(result.itemsToReceive));
    bots!.Result[index]!.itemsToSend = result.itemsToSend;
    bots!.Result[index]!.itemsToReceive = result.itemsToReceive;
    if (result.itemsToSend.length > 0) {
      storeMatches(bots!.Result[index]!.SteamID, result.itemsToSend, result.itemsToReceive);
      addMatchRow(index);
      callback();
    } else {
      debugPrint("no matches");
      callback();
    }
  }

  function storeMatches(steamID: string, itemsToSend: MatchItem[], itemsToReceive: MatchItem[]): void {
    const partner = getPartner(steamID);
    tradeParams.matches[partner] = buildMatchStore(itemsToSend, itemsToReceive, tradeParams.cardNames!);
    SaveParams();
  }

  // Badge details are fetched with bounded concurrency: up to
  // BADGE_DETAIL_CONCURRENCY ajaxgetbadgeinfo requests are in flight at once
  // and each next launch is separated by the web limiter, keeping the
  // per-request rate-limit friendliness of the serial scan while making the
  // detail stage several times faster on badge-heavy accounts. Invalid badges
  // are marked during the crawl and filtered once every badge has settled, so
  // concurrent workers never reorder myBadges under each other.
  const BADGE_DETAIL_CONCURRENCY = 6;

  function GetOwnCards(): void {
    debugPrint("GetOwnCards");
    progressRadials.badges.steps = myBadges.length;
    let nextIndex = 0;
    let settledBadges = 0;
    let aborted = false;
    const invalidBadges = new Set<number>();
    const attempts = Array.from({ length: myBadges.length }, () => 0);

    function fillCards(
      index: number,
      rgCards: Array<{ title: string; markethash: string; owned: number; imgurl: string }>,
    ): void {
      myBadges[index]!.maxCards = rgCards.length;
      for (let i = 0; i < rgCards.length; i++) {
        // Owned copies drive set progress and requests; the inventory counting
        // pass caps what this slot may offer. A game missing from the counting
        // pass leaves tradability unknown, and the matcher then treats every
        // copy as tradable.
        const card = rgCards[i]!;
        const perApp = inventoryCardCounts?.[myBadges[index]!.appId];
        const markethash = card.markethash;
        const newcard: MatchCard = {
          item: card.title,
          hash: markethash,
          count: card.owned,
          iconUrl: card.imgurl,
          number: i,
        };
        if (perApp !== undefined) {
          newcard.tradableCount = perApp[markethash]?.tradable ?? 0;
        }
        debugPrint(JSON.stringify(newcard));
        myBadges[index]!.cards.push(newcard);
        cardNames.add(markethash);
      }
    }

    function fetchBadgeDetail(index: number): void {
      let url = "https://steamcommunity.com/" + myProfileLink + "/ajaxgetbadgeinfo/" + myBadges[index]!.appId;
      let xhr = new XMLHttpRequest();
      xhr.open("GET", url, true);
      xhr.responseType = "json";
      // eslint-disable-next-line
      xhr.onload = function () {
        if (stop) {
          stopEventCleanup("User interrupt");
          aborted = true;
          return;
        }
        let status = xhr.status;
        if (status === 200) {
          try {
            if (Object.keys(xhr.response).length === 1) {
              // invalid badge: mark it; filtered once all badges have settled
              debugPrint(`invalid badge ${myBadges[index]!.appId}`);
              errors = 0;
              invalidBadges.add(index);
              settle();
              return;
            }
            debugPrint("processing badge " + myBadges[index]!.appId);
            if (xhr.response != undefined && xhr.response.eresult == 1) {
              if (xhr.response.badgedata.rgCards.length >= 5) {
                errors = 0;
                fillCards(index, xhr.response.badgedata.rgCards);
                settle();
                return;
              } else {
                debugPrint("less than 5 cards in a badge - something is wrong");
                debugPrint(JSON.stringify(xhr.response));
                errors++;
                attempts[index] = (attempts[index] ?? 0) + 1;
              }
            } else {
              if (xhr.response != undefined) {
                debugPrint("eresult = " + xhr.response.eresult);
              }
              stopEventCleanup(`Badge data fetch error: ${myBadges[index]!.appId}`);
              aborted = true;
              return;
            }
          } catch (error) {
            debugPrint(error);
            debugPrint(JSON.stringify(xhr.response));
            errors++;
            attempts[index] = (attempts[index] ?? 0) + 1;
          }
        } else {
          errors++;
          attempts[index] = (attempts[index] ?? 0) + 1;
        }
        const attemptCount = attempts[index] ?? 0;
        if (
          (status < 400 || status >= 500) &&
          attemptCount <= globalSettings.maxErrors &&
          errors <= globalSettings.maxErrors * BADGE_DETAIL_CONCURRENCY
        ) {
          setTimeout(
            function () {
              fetchBadgeDetail(index);
            },
            retryDelay(globalSettings, errors),
          );
        } else {
          if (status !== 200) {
            debugPrint(`Error getting badge data: ${status}`);
          } else {
            debugPrint("Error getting own badge data, wrong badge " + myBadges[index]!.appId);
          }
          stopEventCleanup(`Error getting badge data: ${status}`);
          aborted = true;
        }
      };
      // eslint-disable-next-line
      xhr.onerror = function () {
        if (stop) {
          stopEventCleanup("User interrupt");
          aborted = true;
          return;
        }
        errors++;
        attempts[index] = (attempts[index] ?? 0) + 1;
        const attemptCount = attempts[index] ?? 0;
        if (attemptCount <= globalSettings.maxErrors) {
          setTimeout(
            function () {
              fetchBadgeDetail(index);
            },
            retryDelay(globalSettings, errors),
          );
          return;
        } else {
          debugPrint("error fetching badge data: max error rate reached");
          stopEventCleanup("Max error rate reached");
          aborted = true;
        }
      };
      xhr.send();
    }

    function settle(): void {
      settledBadges++;
      updateProgress("badges");
      if (settledBadges >= myBadges.length) {
        finish();
        return;
      }
      setTimeout(launch, globalSettings.weblimiter);
    }

    function launch(): void {
      if (aborted || stop) {
        if (stop) {
          stopEventCleanup("User interrupt");
        }
        return;
      }
      if (nextIndex >= myBadges.length) {
        return; // cursor exhausted; remaining workers drain
      }
      fetchBadgeDetail(nextIndex);
      nextIndex++;
    }

    function finish(): void {
      if (aborted) {
        return;
      }
      debugPrint("populated");

      /* Filter invalid badges (marked during the crawl). */
      for (let i = myBadges.length - 1; i >= 0; i--) {
        if (invalidBadges.has(i)) {
          myBadges.splice(i, 1);
        }
      }

      debugTime("Filter and sort");
      for (let i = myBadges.length - 1; i >= 0; i--) {
        debugPrint("badge " + i + JSON.stringify(myBadges[i]!));

        myBadges[i]!.cards.sort((a, b) => b.count - a.count);
        if (myBadges[i]!.cards[0]!.count - myBadges[i]!.cards[myBadges[i]!.cards.length - 1]!.count < 2) {
          //nothing to match, remove from list.
          myBadges.splice(i, 1);
          continue;
        }

        let totalCards = 0;
        for (let j = 0; j < myBadges[i]!.maxCards; j++) {
          totalCards += myBadges[i]!.cards[j]!.count;
        }
        myBadges[i]!.maxSets = Math.floor(totalCards / myBadges[i]!.maxCards);
        myBadges[i]!.lastSet = Math.ceil(totalCards / myBadges[i]!.maxCards);
        debugPrint(
          "totalCards=" + totalCards + " maxSets=" + myBadges[i]!.maxSets + " lastSet=" + myBadges[i]!.lastSet,
        );
      }
      debugTimeEnd("Filter and sort");

      /* Remove scan filters from badges without duplicates. */
      if (globalSettings.autoDeleteScanFilters) {
        const inactiveScanFilters = globalSettings.scanFilters.filter((x) => !x.active);
        const activeValidScanFilters = globalSettings.scanFilters.filter(
          (aFilter) => aFilter.active && myBadges.find((aBadge) => aFilter.appId == aBadge.appId),
        );
        globalSettings.scanFilters = inactiveScanFilters.concat(activeValidScanFilters);
      }

      /* Add badges with duplicates in scan filters. */
      if (globalSettings.autoAddScanFilters) {
        const addToScanFilters = myBadges.filter(
          (aBadge) => !globalSettings.scanFilters.find((aFilter) => aFilter.appId == aBadge.appId),
        );
        const newScanFilters = Array.from(addToScanFilters, (aBadge) => ({
          appId: aBadge.appId,
          title: aBadge.title,
          active: true,
        }));
        globalSettings.scanFilters = globalSettings.scanFilters.concat(newScanFilters);
      }

      if (globalSettings.autoDeleteScanFilters || globalSettings.autoAddScanFilters) {
        SaveConfig();
      }

      if (myBadges.length === 0) {
        stopEventCleanup("No badges to match");
        return;
      }
      SaveParams();
      progressRadials.bots.steps = bots!.Result.length;
      GetCards(0, 0);
    }

    if (myBadges.length === 0) {
      finish();
      return;
    }
    for (let i = 0; i < BADGE_DETAIL_CONCURRENCY && i < myBadges.length; i++) {
      launch();
    }
  }

  function GetCards(index: number, userindex: number, idLink?: string): void {
    debugPrint("GetCards " + index + " : " + userindex);

    if (index === 0 && userindex === 0) {
      progressRadials.botBadges.steps = myBadges.length;
    }

    if (userindex >= bots!.Result.length) {
      debugPrint("finished");
      debugPrint(new Date(Date.now()));
      updateProgress("bots");
      stopEventCleanup("Scan completed");
      return;
    }

    if (
      (bots!.Result[userindex]!.MatchEverything && !globalSettings.anyBots) ||
      (!bots!.Result[userindex]!.MatchEverything && !globalSettings.fairBots) ||
      bots!.Result[userindex]!.TotalInventoryCount < globalSettings.botMinItems ||
      (globalSettings.botMaxItems > 0 && bots!.Result[userindex]!.TotalInventoryCount > globalSettings.botMaxItems) ||
      blacklist.includes(bots!.Result[userindex]!.SteamID)
    ) {
      debugPrint("Ignoring bot " + bots!.Result[userindex]!.SteamID);
      debugPrint(bots!.Result[userindex]!.MatchEverything && !globalSettings.anyBots);
      debugPrint(!bots!.Result[userindex]!.MatchEverything && !globalSettings.fairBots);
      debugPrint(bots!.Result[userindex]!.TotalInventoryCount >= globalSettings.botMinItems);
      debugPrint(
        globalSettings.botMaxItems > 0 && bots!.Result[userindex]!.TotalInventoryCount <= globalSettings.botMaxItems,
      );
      debugPrint(blacklist.includes(bots!.Result[userindex]!.SteamID));
      updateProgress("bots");
      updateProgress("botBadges");
      GetCards(0, userindex + 1);
      return;
    }

    // scan bot badge step
    if (index === 0) {
      botBadges.length = 0;
      botBadges = deepClone(myBadges);
      for (let i = 0; i < botBadges.length; i++) {
        botBadges[i]!.cards.length = 0;
      }
      progressRadials.botBadges.currentStep = 0;
      updateProgress("bots");
    }

    if (index < botBadges.length) {
      let profileLink = globalSettings.matchFriends
        ? `${bots!.Result[userindex]!.SteamIDText}`
        : `profiles/${bots!.Result[userindex]!.SteamID}`;
      updateProgress("botBadges");

      let url = `https://steamcommunity.com/${idLink ?? profileLink}/gamecards/${botBadges[index]!.appId}`;
      let xhr = new XMLHttpRequest();
      xhr.open("GET", url, true);
      xhr.responseType = "document";
      // eslint-disable-next-line
      xhr.onload = function () {
        if (stop) {
          stopEventCleanup("User interrupt");
          return;
        }
        let status = xhr.status;
        if (status === 200) {
          debugPrint("processing badge " + botBadges[index]!.appId);
          if (null === xhr.response.documentElement.querySelector(".badge_card_set_cards")) {
            if (globalSettings.matchFriends) {
              debugPrint(
                "friend has inventory set to friends-only (badges are private):" + bots!.Result[userindex]!.SteamID,
              );
            } else {
              debugPrint("bot has private profile:" + bots!.Result[userindex]!.SteamID);
            }
            updateProgress("bots");
            // Blacklist private users, saves time
            blacklist.push(bots!.Result[userindex]!.SteamID);
            SaveConfig();
            setTimeout(
              (function (index, userindex) {
                return function () {
                  GetCards(index, userindex);
                };
              })(0, userindex + 1),
              retryDelay(globalSettings, errors),
            );
            return;
          }
          let badgeCards = xhr.response.documentElement.querySelectorAll(".badge_card_set_card");
          if (badgeCards.length >= 5) {
            errors = 0;
            botBadges[index]!.maxCards = badgeCards.length;
            for (let i = 0; i < badgeCards.length; i++) {
              let quantityElement = badgeCards[i].querySelector(".badge_card_set_text_qty");
              let quantity = quantityElement === null ? "(0)" : (quantityElement as HTMLElement).innerText.trim();
              quantity = quantity.slice(1, -1);
              let name = "";
              badgeCards[i].querySelector(".badge_card_set_title")!.childNodes.forEach(function (element: ChildNode) {
                if (element.nodeType === Node.TEXT_NODE) {
                  name = name + element.textContent;
                }
              });
              name = name.trim();
              let markethash = myBadges[index]!.cards.find((card) => card.number === i)!.hash;
              let icon = (badgeCards[i].querySelector(".gamecard") as HTMLImageElement).src.trim();
              let newcard = {
                item: name,
                hash: markethash,
                count: Number(quantity),
                iconUrl: icon,
                number: i,
              };
              debugPrint(JSON.stringify(newcard));
              botBadges[index]!.cards.push(newcard);
            }

            idLink ??= xhr.responseURL.match(/(id\/.+?)\//)?.[1];

            index++;
            setTimeout(
              (function (index, userindex, idLink) {
                return function () {
                  GetCards(index, userindex, idLink);
                };
              })(index, userindex, idLink),
              globalSettings.weblimiter,
            );
            return;
          } else {
            // private inventory?
            debugPrint(xhr.response.documentElement.outerHTML);
            const elemCount = xhr.response.documentElement.querySelectorAll(".badge_detail_tasks").length;
            debugPrint(`elemCount = ${elemCount} (1?)`);
            errors++;
          }
        } else {
          errors++;
        }
        if ((status < 400 || status >= 500) && errors <= globalSettings.maxErrors) {
          setTimeout(
            (function (index, userindex, idLink) {
              return function () {
                GetCards(index, userindex, idLink);
              };
            })(index, userindex, idLink),
            retryDelay(globalSettings, errors),
          );
        } else {
          if (status !== 200) {
            debugPrint(`Error getting badge data: ${status}`);
          } else {
            debugPrint("Error getting badge data, malformed HTML. Ignoring badge " + botBadges[index]!.appId);
            setTimeout(
              (function (index, userindex, idLink) {
                return function () {
                  GetCards(index, userindex, idLink);
                };
              })(index, userindex, idLink),
              retryDelay(globalSettings, errors),
            );
          }
          stopEventCleanup(`Error getting badge data: ${status}`);
          return;
        }
      };
      // eslint-disable-next-line
      xhr.onerror = function () {
        if (stop) {
          stopEventCleanup("User interrupt");
          return;
        }
        errors++;
        if (errors <= globalSettings.maxErrors) {
          setTimeout(
            (function (index, userindex, idLink) {
              return function () {
                GetCards(index, userindex, idLink);
              };
            })(index, userindex, idLink),
            retryDelay(globalSettings, errors),
          );
          return;
        } else {
          debugPrint("error fetching bot badge: max error rate reached");
          stopEventCleanup("Max error rate reached");
          return;
        }
      };
      xhr.send();
      return; //do this synchronously to avoid rate limit
    }
    debugPrint("populated");

    debugTime("Filter and sort");
    for (let i = botBadges.length - 1; i >= 0; i--) {
      debugPrint("badge " + i + JSON.stringify(botBadges[i]!));

      botBadges[i]!.cards.sort((a, b) => b.count - a.count);
      let totalCards = 0;
      for (let j = 0; j < botBadges[i]!.maxCards; j++) {
        totalCards += botBadges[i]!.cards[j]!.count;
      }
      botBadges[i]!.maxSets = Math.floor(totalCards / botBadges[i]!.maxCards);
      botBadges[i]!.lastSet = Math.ceil(totalCards / botBadges[i]!.maxCards);
      debugPrint(
        "totalCards=" + totalCards + " maxSets=" + botBadges[i]!.maxSets + " lastSet=" + botBadges[i]!.lastSet,
      );
    }
    debugTimeEnd("Filter and sort");

    debugPrint(bots!.Result[userindex]!.SteamID);
    compareCards(userindex, function () {
      setTimeout(
        (function (userindex) {
          return function () {
            GetCards(0, userindex);
          };
        })(userindex + 1),
        globalSettings.weblimiter,
      );
    });
  }

  function processFilters(scanPlan: ScanPlan): boolean {
    // The scan plan is snapshotted when Scan is clicked so the executed path
    // always matches the saved setting, even when the bot list is refetched
    // first. Scan filters take precedence over the inventory scan by design.
    const plan = scanPlan || resolveScanPlan(globalSettings);
    const activeScanFilters = globalSettings.scanFilters.filter((x) => x.active);
    if (plan.mode === "filters" && activeScanFilters.length) {
      for (let filter of activeScanFilters) {
        let badgeStub: Badge = {
          appId: Number(filter.appId),
          title: filter.title,
          maxCards: 0,
          maxSets: 0,
          lastSet: 0,
          cards: [],
        };
        myBadges.push(badgeStub);
      }
      progressRadials.scanPages.steps = 1;
      progressRadials.scanPages.radialElement!.classList.add("full-blue");
      updateProgress("scanPages");
      setTimeout(
        function () {
          GetOwnCards();
        },
        retryDelay(globalSettings, errors),
      );
      return true;
    }
    return false;
  }

  async function fetchInventory(runId: number): Promise<InventoryData & { success?: unknown }> {
    const re = /g_steamID = "(.*)";/g;
    const g_steamID = (re.exec(document.documentElement.textContent as string) as RegExpExecArray)[1] as string;
    const sleep = (ms: number): Promise<unknown> => new Promise((r) => setTimeout(r, ms));

    const baseUrl = `https://steamcommunity.com/inventory/${g_steamID}/753/6?l=english&count=2000`;

    const inventory: InventoryData & { success?: unknown } = {
      assets: [],
      descriptions: [],
    };

    let startAssetId: string | null = null;
    let firstRequest = true;

    while (true) {
      if (runId !== undefined && (runId !== scanRunId || stop)) {
        throw new Error("Scan superseded by a newer run");
      }
      if (!firstRequest) {
        await sleep(globalSettings.inventoryScanDelay);
      }

      const url: string = startAssetId ? `${baseUrl}&start_assetid=${startAssetId}` : baseUrl;

      const response: Response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}`);
      }

      const data: any = await response.json();

      // Validate each entry before it can influence counting: malformed
      // entries are skipped, unknown Steam fields are ignored.
      if (data.descriptions) {
        for (const raw of data.descriptions) {
          const description = parseInventoryDescription(raw);
          if (!description) {
            continue;
          }
          const itemClass = description.tags?.find((tag) => tag.category === "item_class");

          if (itemClass?.internal_name === "item_class_2") {
            inventory.descriptions.push(description);
          }
        }
      }

      // Keep the assets from this page
      if (data.assets) {
        for (const raw of data.assets) {
          const asset = parseInventoryAsset(raw);
          if (asset) {
            inventory.assets.push(asset);
          }
        }
      }

      inventory.success = data.success;
      if (firstRequest) {
        progressRadials.scanPages.steps = Math.ceil(data.total_inventory_count / 2000) + 1;
      }
      updateProgress("scanPages");

      // item_class_3 means we've reached the end of item_class_2
      const reachedClass3 = data.descriptions?.some(
        (description: { tags?: Array<{ category?: string; internal_name?: string }> }) =>
          description.tags?.some(
            (tag: { category?: string; internal_name?: string }) =>
              tag.category === "item_class" && ["item_class_3", "item_class_4"].includes(tag.internal_name as string),
          ),
      );

      if (reachedClass3 || !data.more_items) {
        progressRadials.scanPages.steps = 1;
        progressRadials.scanPages.radialElement!.classList.add("full-blue");
        updateProgress("scanPages");
        break;
      }

      startAssetId = data.last_assetid;
      firstRequest = false;
    }

    return inventory;
  }

  /* Tradability helpers (isTradableDescription, buildInventoryCardCounts,
       resolveOwnedCount, buildScanEligibility) live in src/lib/tradable.js and
       are inlined here by script/build.py so dist stays single-file. */
  // Tradability helpers arrive via the ./lib/tradable import at the top of this file.

  /* Settings helpers (mergeWithDefaults, resolveScanPlan) live in
       src/lib/settings.js and are inlined here by script/build.py. */
  // Settings helpers arrive via the ./lib/settings import at the top of this file.

  async function getBadgesInventory(inventoryData: InventoryData, runId: number, scanPlan: ScanPlan): Promise<void> {
    inventoryCardCounts = buildInventoryCardCounts(inventoryData);

    if (processFilters(scanPlan)) {
      return;
    }

    const fetchJSON = async (url: string): Promise<unknown> => {
      const request = resolveRequestFunction({ legacyRequest: GM_xmlhttpRequest, modernApi: GM });
      const text = await gmGet(request, { url });
      return JSON.parse(text);
    };
    const badgeCardData = (await fetchJSON(
      "https://raw.githubusercontent.com/nolddor/steam-badges-db/main/data/badges.min.json",
    )) as Record<string, BadgeCardInfo>;
    if (runId !== undefined && (runId !== scanRunId || stop)) {
      return; // superseded by a newer scan run
    }

    const scanResult = buildScanEligibility(inventoryCardCounts, badgeCardData);

    /* Push badge stub to myBadges list */
    for (let appId of Object.keys(scanResult)) {
      if (scanResult[appId]!.unbalanced) {
        myBadges.push({
          appId: Number(appId),
          title: badgeCardData[appId]!.name!,
          maxCards: 0,
          maxSets: 0,
          lastSet: 0,
          cards: [],
        });
      }
    }
    setTimeout(
      function () {
        GetOwnCards();
      },
      retryDelay(globalSettings, errors),
    );
  }

  function addScanFilterEventHandler(): void {
    const appIdBox = document.querySelector("#addScanFilterAppId") as HTMLInputElement;
    const appId = appIdBox.value;
    const response = AddScanFilter(appId);
    updateScanFilterAppName(appId);
    const statusElement = document.querySelector("#addScanFilterStatus") as HTMLElement;
    statusElement.style.transition = null as unknown as string;
    statusElement.style.opacity = "1";
    statusElement.innerText = response.message;
    if (response.success) {
      const newScanFilter = createScanFilterElement(true, appId, appId);
      document.querySelector("#asf-stm-filters")!.innerHTML += newScanFilter;
      statusElement.style.color = "#88ff88";
    } else {
      statusElement.style.color = "#ffa7a2";
    }
    appIdBox.value = null as unknown as string;
    setTimeout(function () {
      statusElement.style.transition = "opacity 3s ease-out";
      statusElement.style.opacity = "0";
    }, 0);
  }

  async function updateScanFilterAppName(appId: string): Promise<unknown> {
    const request = resolveRequestFunction({ legacyRequest: GM_xmlhttpRequest, modernApi: GM });
    const responseText = await gmGet(request, {
      url: `https://steamcommunity.com/${myProfileLink}/gamecards/${appId}`,
    });
    const selector = responseText.split('profile_small_header_location">')[2];
    if (!selector) {
      const element = document.querySelector(`#scan-filter-${appId}`);
      if (element) {
        element.remove();
      }
      globalSettings.scanFilters = globalSettings.scanFilters.filter((x) => x.appId !== appId);
      return `Invalid appId: ${appId}`;
    }
    const title = selector.split("</span")[0] as string;
    globalSettings.scanFilters.find((x) => x.appId == appId)!.title = title;
    const anchor = document.querySelector(`#scan-filter-name-${appId}`);
    if (anchor) {
      Array.from(anchor.childNodes).find((x) => x.nodeType === Node.TEXT_NODE)!.nodeValue = title;
    }
    return title;
  }

  function clearScanFiltersEventHandler() {
    ResetScanFilters();
    unsafeWindow
      .ShowConfirmDialog("CONFIRMATION", "Are you sure you want to clear all scan filters?")
      .done(function () {
        SaveConfig();
      });
  }

  function filterEventHandler(event: { target: EventTarget | null }): void {
    const target = event.target as HTMLInputElement;
    let appId = target.id.split("_")[1];
    let matches = document.getElementsByClassName("asf_stm_appid_" + appId) as HTMLCollectionOf<HTMLElement>;
    for (let i = 0; i < matches.length; i++) {
      if (target.checked) {
        matches[i]!.style.display = "inline-block";
        if (!tradeParams.filter.includes(Number(appId))) {
          tradeParams.filter.push(Number(appId));
        }
      } else {
        matches[i]!.style.display = target.checked ? "inline-block" : "none";
        let index = tradeParams.filter.indexOf(Number(appId));
        if (index !== -1) {
          tradeParams.filter.splice(index, 1);
        }
      }
      checkRow(matches[i]!.parentElement!.parentElement!);
    }
    SaveParams();
  }

  function filterSwitchesHandler(event: Event): void {
    let action = (event.target as HTMLElement).id.split("_")[3];
    let filterWidget = document.getElementById("asf_stm_filters_body") as HTMLElement;
    let checkboxes = filterWidget.getElementsByTagName("input");
    for (let i = 0; i < checkboxes.length; i++) {
      if (action === "all") {
        if (!checkboxes[i]!.checked) {
          checkboxes[i]!.checked = true;
          filterEventHandler({ target: checkboxes[i]! });
        }
      } else if (action === "none") {
        if (checkboxes[i]!.checked) {
          checkboxes[i]!.checked = false;
          filterEventHandler({ target: checkboxes[i]! });
        }
      } else if (action === "invert") {
        checkboxes[i]!.checked = !checkboxes[i]!.checked;
        filterEventHandler({ target: checkboxes[i]! });
      }
    }
  }

  function filtersButtonEvent(): void {
    let filterWidget = document.getElementById("asf_stm_filters") as HTMLElement;
    if (filterWidget.style.marginRight === "-50%") {
      filterWidget.style.marginRight = "unset";
    } else {
      filterWidget.style.marginRight = "-50%";
    }
  }

  function stopButtonEvent(): void {
    (document.querySelector("#asf_stm_stop_div") as HTMLElement).hidden = true;
    stop = true;
    Object.values(progressRadials).map((x) => {
      x.textElement!.textContent = "❌";
    });
  }

  function stopEventCleanup(reason: string): void {
    // Hide throbber
    (document.querySelector("#throbber") as HTMLElement).style.display = "none";
    enableButton();
    (document.querySelector("#asf_stm_stop_div") as HTMLElement).hidden = true;
    console.log(`Stopping: ${reason}`);
  }

  // Aborts a scan with a visible, retryable error instead of silently
  // degrading to another discovery path.
  function abortInventoryScan(message: string): void {
    debugPrint(message);
    const statusElement = document.getElementById("scan-pages-text") as HTMLElement | null;
    if (statusElement) {
      statusElement.textContent = "Error";
      statusElement.title = message;
    }
    if (typeof unsafeWindow.ShowAlertDialog === "function") {
      unsafeWindow.ShowAlertDialog("Inventory scan failed", message);
    }
    stopEventCleanup(message);
  }

  async function prepareInventoryScan(runId: number, scanPlan: ScanPlan): Promise<void> {
    const plan = scanPlan || resolveScanPlan(globalSettings);
    let inventoryData: (InventoryData & { success?: unknown }) | null = null;
    try {
      inventoryData = await fetchInventory(runId);
    } catch (error) {
      debugPrint("Inventory fetch failed: " + error);
    }
    if (runId !== undefined && (runId !== scanRunId || stop)) {
      return; // superseded by a newer scan run; that run owns the UI now
    }

    if (inventoryData === null) {
      abortInventoryScan("Steam inventory is unavailable, inventory scan aborted. Try again later.");
      return;
    }
    try {
      await getBadgesInventory(inventoryData, runId, plan);
    } catch (error) {
      debugPrint("Badge database fetch failed: " + error);
      if (runId !== undefined && (runId !== scanRunId || stop)) {
        return;
      }
      abortInventoryScan("Steam badges database is unavailable, inventory scan aborted. Try again later.");
    }
  }

  function buttonPressedEvent(pendingPlan?: ScanPlan | Event): void {
    // Snapshot the scan mode at click time and carry it through the cold
    // bot-cache refetch below, so the first scan of the day runs in the
    // saved mode (filters vs. inventory) exactly like a retry.
    // A click carries a MouseEvent (truthy) while programmatic calls carry a
    // plan or nothing; the cast preserves the original truthiness behavior.
    const scanPlan = (pendingPlan as ScanPlan | undefined) || resolveScanPlan(globalSettings);
    if (globalSettings.preventClose) {
      window.addEventListener("beforeunload", function (e) {
        e.preventDefault();
      });
    }
    if (
      bots === null ||
      (bots!.Result as BotEntry[] | undefined) === undefined ||
      bots!.Result.length === 0 ||
      bots!.Success !== true ||
      (bots!.cacheTime as number) + botCacheTime < Date.now() ||
      globalSettings.matchFriends !== bots!.friends
    ) {
      debugPrint("Bot cache invalidated");
      fetchBots(scanPlan);
      return;
    }
    if (!globalSettings.matchFriends) {
      bots!.Result.sort(botSorter);
    }
    disableButton();
    debugPrint(new Date(Date.now()));
    debugPrint("scan plan: mode=" + scanPlan.mode + " useScanFilters=" + scanPlan.useScanFilters);
    let mainContentDiv = document.getElementsByClassName("maincontent")[0] as HTMLElement;
    mainContentDiv.textContent = "";
    mainContentDiv.style.width = "90%";
    mainContentDiv.innerHTML = renderMainContent({
      firstRadialName: getFirstRadialName(scanPlan),
      matchFriends: globalSettings.matchFriends,
      filterBackgroundColor: globalSettings.filterBackgroundColor,
    });
    (document.getElementById("asf_stm_filters_body") as HTMLElement).addEventListener("change", filterEventHandler);
    (document.getElementById("asf_stm_filter_all") as HTMLElement).addEventListener("click", filterSwitchesHandler);
    (document.getElementById("asf_stm_filter_none") as HTMLElement).addEventListener("click", filterSwitchesHandler);
    (document.getElementById("asf_stm_filter_invert") as HTMLElement).addEventListener("click", filterSwitchesHandler);
    (document.getElementById("asf_stm_filters_button") as HTMLElement).addEventListener(
      "click",
      filtersButtonEvent,
      false,
    );
    observer.observe(document.querySelector("#asf_stm_filters_body")!, {
      attributes: true,
      childList: true,
      subtree: true,
    });
    (document.querySelector("#asf_stm_stop_div") as HTMLElement).hidden = false;
    resetRadials();
    stop = false;
    scanRunId++;
    const runId = scanRunId;
    myBadges.length = 0;
    cardNames = new Set();
    tradeParams = {
      matches: {},
      filter: [],
    };
    prepareInventoryScan(runId, scanPlan);
  }

  function resetRadials() {
    progressRadials = {
      scanPages: {
        currentStep: 0,
        steps: 0,
        radialElement: document.querySelector("#scan-pages-radial") as HTMLElement,
        textElement: document.querySelector("#scan-pages-text") as HTMLElement,
      },
      badges: {
        currentStep: 0,
        steps: 0,
        radialElement: document.querySelector("#scan-badges-radial") as HTMLElement,
        textElement: document.querySelector("#scan-badges-text") as HTMLElement,
      },
      bots: {
        currentStep: 0,
        steps: 0,
        radialElement: document.querySelector("#scan-bots-radial") as HTMLElement,
        textElement: document.querySelector("#scan-bots-text") as HTMLElement,
      },
      botBadges: {
        currentStep: 0,
        steps: 0,
        radialElement: document.querySelector("#bots-badges-radial") as HTMLElement,
        textElement: document.querySelector("#bots-badges-text") as HTMLElement,
      },
    };

    const radialElements = Array.from(document.querySelectorAll<HTMLElement>(".radial-progress"));
    for (let radialElement of radialElements) {
      radialElement.classList.remove("full-blue");
      radialElement.style.setProperty("--progress", "0deg");
    }

    const textElements = Array.from(document.querySelectorAll<HTMLElement>(".progress-inner"));
    for (let textElement of textElements) {
      textElement.textContent = "?";
    }
  }

  function botSorter(a: BotEntry, b: BotEntry): number {
    let result = 0;
    for (let i = 0; i < globalSettings.sortBotsBy.length; i++) {
      switch (globalSettings.sortBotsBy[i]) {
        case "MatchEverythingFirst":
          result = Number(b.MatchEverything) - Number(a.MatchEverything);
          break;
        case "MatchEverythingLast":
          result = Number(a.MatchEverything) - Number(b.MatchEverything);
          break;
        case "TotalGamesCountDesc":
          result = Number(b.TotalGamesCount) - Number(a.TotalGamesCount);
          break;
        case "TotalGamesCountAsc":
          result = Number(a.TotalGamesCount) - Number(b.TotalGamesCount);
          break;
        case "TotalItemsCountDesc":
          result = Number(b.TotalItemsCount) - Number(a.TotalItemsCount);
          break;
        case "TotalItemsCountAsc":
          result = Number(a.TotalItemsCount) - Number(b.TotalItemsCount);
          break;
        case "TotalInventoryCountDesc":
          result = b.TotalInventoryCount - a.TotalInventoryCount;
          break;
        case "TotalInventoryCountAsc":
          result = a.TotalInventoryCount - b.TotalInventoryCount;
          break;
      }
      if (result !== 0) {
        break;
      }
    }
    return result;
  }

  function fetchBots(pendingPlan?: ScanPlan): void {
    let requestUrl = "https://asf.justarchi.net/Api/Listing/Bots";
    if (globalSettings.matchFriends) {
      requestUrl = "https://steamcommunity.com/actions/PlayerList/?type=friends";
    }
    let requestFunc = resolveRequestFunction({ legacyRequest: GM_xmlhttpRequest, modernApi: GM });
    requestFunc({
      method: "GET",
      url: requestUrl,
      headers: {
        "User-Agent": "ASF-STM/" + GM_info.version,
      },
      onload: function (response: GmRequestResponse) {
        if (response.status !== 200) {
          disableButton();
          (document.getElementById("asf_stm_button_div") as HTMLElement).setAttribute(
            "title",
            "Can't fetch list of bots",
          );
          debugPrint("can't fetch list of bots, ERROR=" + response.status);
          debugPrint(JSON.stringify(response));
          return;
        }
        try {
          if (globalSettings.matchFriends) {
            const parser = new DOMParser();
            const friendListDocument = parser.parseFromString(response.response ?? response.responseText, "text/html");
            let steamID3 = Array.from(
              friendListDocument.querySelectorAll<HTMLElement>("div.friendBlock"),
              (x) => x.dataset.miniprofile,
            );
            let profile = Array.from(
              friendListDocument.querySelectorAll<HTMLAnchorElement>("a.friendBlockLinkOverlay"),
              (x) => x.href.replace(/https:\/\/steamcommunity.com\//g, ""),
            );
            let avatarHash = Array.from(
              friendListDocument.querySelectorAll<HTMLImageElement>("img"),
              (img) => img.src,
            ).map((str) => (str.match(/[a-z0-9]{40}/) ? str.match(/[a-z0-9]{40}/)![0]! : null));
            let nickname = Array.from(friendListDocument.querySelectorAll<HTMLElement>("div.friendBlockContent"), (x) =>
              (x.childNodes[0] as Text).data.trim(),
            );
            bots = {
              friends: true,
              Success: true,
              cacheTime: Date.now(),
              Result: profile.map((profileLink, index) => ({
                SteamIDText: profileLink,
                AvatarHash: avatarHash[index]!,
                MatchableTypes: [2, 3, 4, 5],
                MatchEverything: false,
                MaxTradeHoldDuration: 0,
                Nickname: nickname[index]!,
                SteamID: steamID3[index]!,
                TotalGamesCount: 100,
                TotalInventoryCount: 100,
                TotalItemsCount: 100,
                TradeToken: null,
              })),
            };
          } else {
            let re = /("SteamID":)(\d+)/g;
            let fixedJson = (response.response ?? response.responseText).replace(re, '$1"$2"'); //because fuck js
            bots = JSON.parse(fixedJson);
            bots!.cacheTime = Date.now();
            bots!.friends = false;
          }
          if (bots!.Success) {
            // Filter bots without TradingCard (5) preference in MatchableTypes
            // https://github.com/JustArchiNET/ArchiSteamFarm/wiki/Configuration#matchabletypes
            bots!.Result = bots!.Result.filter((bot) => bot.MatchableTypes.find((x) => x === 5));
            debugPrint("found total " + bots!.Result.length + " bots");
            writeJson(localStorage, STORAGE_KEYS.botCache, bots);
            buttonPressedEvent(pendingPlan);
          } else {
            //ASF backend does not indicate success
            disableButton();
            (document.getElementById("asf_stm_button_div") as HTMLElement).setAttribute(
              "title",
              "Can't fetch list of bots, try later",
            );
            debugPrint("can't fetch list of bots");
            debugPrint(bots!.Message);
            debugPrint(JSON.stringify(response));
            return;
          }
          return;
        } catch (e) {
          disableButton();
          (document.getElementById("asf_stm_button_div") as HTMLElement).setAttribute(
            "title",
            "Can't fetch list of bots, try later",
          );
          debugPrint("can't fetch list of bots");
          debugPrint(e);
          debugPrint(JSON.stringify(response));
          return;
        }
      },
      onerror: function (response: unknown) {
        disableButton();
        (document.getElementById("asf_stm_button_div") as HTMLElement).setAttribute(
          "title",
          "Can't fetch list of bots",
        );
        debugPrint("can't fetch list of bots");
        debugPrint(JSON.stringify(response));
      },
      onabort: function (response: unknown) {
        disableButton();
        (document.getElementById("asf_stm_button_div") as HTMLElement).setAttribute(
          "title",
          "Can't fetch list of bots",
        );
        debugPrint("can't fetch list of bots - aborted");
        debugPrint(JSON.stringify(response));
      },
      ontimeout: function (response: unknown) {
        disableButton();
        (document.getElementById("asf_stm_button_div") as HTMLElement).setAttribute(
          "title",
          "Can't fetch list of bots",
        );
        debugPrint("can't fetch list of bots - timeout");
        debugPrint(JSON.stringify(response));
      },
    });
  }
  //Main
  LoadConfig();
  if (document.getElementsByClassName("badge_details_set_favorite").length !== 0) {
    let profileRegex = /http[s]?:\/\/steamcommunity.com\/(.*)\/badges.*/g;
    let result = profileRegex.exec(document.location.href);
    if (result) {
      myProfileLink = result[1] as string;
    } else {
      //should never happen, but whatever.
      myProfileLink = "my";
    }

    debugPrint(profileRegex);

    let botCache = readJson<BotsResponse | null>(localStorage, STORAGE_KEYS.botCache, null);
    if (
      botCache === null ||
      botCache.cacheTime === undefined ||
      botCache.cacheTime === null ||
      botCache.cacheTime + botCacheTime < Date.now() ||
      globalSettings.matchFriends !== botCache.friends
    ) {
      botCache = null;
      debugPrint("Bot cache invalidated");
    } else {
      bots = botCache;
    }
    // Scan
    let buttonDiv = document.createElement("div");
    buttonDiv.setAttribute("class", "profile_small_header_additional");
    buttonDiv.setAttribute("style", "margin-top: 40px; right: 110px");
    buttonDiv.setAttribute("id", "asf_stm_button_div");
    buttonDiv.setAttribute("title", "Scan ASF STM");
    let button = document.createElement("a");
    button.setAttribute("class", "btnv6_blue_hoverfade btn_medium");
    button.setAttribute("id", "asf_stm_button");
    button.appendChild(document.createElement("span"));
    (button.firstChild as HTMLSpanElement).appendChild(document.createTextNode("Scan ASF STM"));
    buttonDiv.appendChild(button);
    let anchor = document.getElementsByClassName("profile_small_header_texture")[0] as HTMLElement;
    anchor.appendChild(buttonDiv);
    // Config
    let confButtonDiv = document.createElement("div");
    confButtonDiv.setAttribute("class", "profile_small_header_additional");
    confButtonDiv.setAttribute("style", "margin-top: 40px; right: 70px");
    confButtonDiv.setAttribute("id", "asf_stm_config_div");
    confButtonDiv.setAttribute("title", "Configuration");
    let confButton = document.createElement("a");
    confButton.setAttribute("class", "btnv6_blue_hoverfade btn_medium_thin");
    confButton.setAttribute("id", "asf_stm_config");
    confButton.appendChild(document.createElement("span"));
    (confButton.firstChild as HTMLSpanElement).appendChild(document.createTextNode("⚙️"));
    confButtonDiv.appendChild(confButton);
    anchor.appendChild(confButtonDiv);
    confButton.addEventListener("click", ShowConfigDialog, false);
    // Stop
    let stopButtonDiv = document.createElement("div");
    stopButtonDiv.setAttribute("class", "profile_small_header_additional");
    stopButtonDiv.setAttribute("style", "margin-top: 40px;");
    stopButtonDiv.setAttribute("id", "asf_stm_stop_div");
    stopButtonDiv.setAttribute("title", "Stop");
    stopButtonDiv.hidden = true;
    let stopButton = document.createElement("a");
    stopButton.setAttribute("class", "btn_darkred_white_innerfade btn_medium_thin");
    stopButton.appendChild(document.createElement("span"));
    (stopButton.firstChild as HTMLSpanElement).appendChild(document.createTextNode("🛑"));
    stopButtonDiv.appendChild(stopButton);
    anchor.appendChild(stopButtonDiv);
    stopButton.addEventListener("click", stopButtonEvent, false);

    enableButton();

    // add our styles to the document's style sheet
    if (typeof GM_addStyle !== "undefined") {
      GM_addStyle(css);
    } else {
      const node = document.createElement("style");
      node.appendChild(document.createTextNode(css));
      const heads = document.getElementsByTagName("head");
      if (heads.length > 0) {
        heads[0]!.appendChild(node);
      } else {
        // no head yet, stick it whereever
        document.documentElement.appendChild(node);
      }
    }
  } else {
    //Code below is a heavily modified version of SteamTrade Matcher Userscript by Tithen-Firion
    //Original can be found on https://github.com/Tithen-Firion/STM-UserScript

    // MIT License
    // Copyright (c) 2017 Tithen-Firion
    // Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
    // The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
    // THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

    function getRandomInt(min: number, max: number): number {
      "use strict";
      return Math.floor(Math.random() * (max - min)) + min;
    }

    function mySort(a: { id: string }, b: { id: string }): number {
      "use strict";
      return parseInt(b.id) - parseInt(a.id);
    }

    ///// Steam functions /////

    function restoreCookie(oldCookie: string | undefined): void {
      "use strict";
      if (oldCookie) {
        let now = new Date();
        let time = now.getTime();
        time += 15 * 24 * 60 * 60 * 1000;
        now.setTime(time);
        document.cookie =
          "strTradeLastInventoryContext=" + oldCookie + "; expires=" + now.toUTCString() + "; path=/tradeoffer/";
      }
    }

    function addCards(g_s: any, g_v: any): void {
      "use strict";
      let tmpCards: Record<string, Array<{ type: string; element: unknown; id: string }>>;
      let inv: any;
      let index: number;
      let currentCards: Array<{ type: string; element: unknown; id: string }>;
      let failLater = false;
      let cardTypes: string[][] = [[], []];
      g_v.Cards.forEach(function (requestedCards: string[], i: number) {
        tmpCards = {};
        inv = g_v.Users[i].rgContexts[753][6].inventory;
        inv.BuildInventoryDisplayElements();
        inv = inv.rgInventory;
        Object.keys(inv).forEach(function (item: string) {
          // add all matching cards to temporary dict
          index = requestedCards.findIndex((elem: string) => elem == inv[item].market_hash_name);
          if (index > -1) {
            // Skip copies Steam would omit from the trade: trade-held
            // cards and cards with a future "Tradable After" date.
            // When every copy is held, the request falls through to
            // the existing missing-items abort below.
            if (!isTradeOfferItemTradable(inv[item])) {
              return;
            }
            if (tmpCards[requestedCards[index]!] === undefined) {
              tmpCards[requestedCards[index]!] = [];
            }
            tmpCards[requestedCards[index]!]!.push({
              type: inv[item].type,
              element: inv[item].element,
              id: inv[item].id,
            });
          }
        });
        if (g_s.order === "SORT") {
          // sort cards descending by card id for each type
          Object.keys(tmpCards).forEach(function (id: string) {
            tmpCards[id]!.sort(mySort);
          });
        }
        // add cards to trade in order given by STM
        requestedCards.forEach(function (elem: string) {
          currentCards = tmpCards[elem] || []; // all cards from inventory with requested signature
          if (currentCards!.length === 0) {
            failLater = true;
          } else {
            index = 0;
            if (g_s.order === "RANDOM") {
              // randomize index
              index = getRandomInt(0, currentCards!.length);
            }
            unsafeWindow.MoveItemToTrade(currentCards![index]!.element);
            cardTypes[i]!.push(currentCards![index]!.type);
            currentCards!.splice(index, 1);
          }
        });
      });

      if (
        failLater ||
        document.querySelectorAll("#your_slots .has_item").length !==
          document.querySelectorAll("#their_slots .has_item").length
      ) {
        unsafeWindow.ShowAlertDialog(
          "Items missing",
          "Some items are missing and were not added to trade offer. Script aborting.",
        );
        throw "Cards missing";
      }

      // check if item types match
      cardTypes[1]!.forEach(function (type: string) {
        index = cardTypes[0]!.indexOf(type);
        if (index > -1) {
          cardTypes[0]!.splice(index, 1);
        } else {
          unsafeWindow.ShowAlertDialog("Not 1:1 trade", "This is not a valid 1:1 trade. Script aborting.");
          throw "Not 1:1 trade";
        }
      });
      restoreCookie(g_v.oldCookie);
      // inject some JS to do something after trade offer is sent
      if (g_s.doAfterTrade !== "NOTHING") {
        let functionToInject = 'let doAfterTrade = "' + g_s.doAfterTrade + '";';
        functionToInject += "$J(document).ajaxSuccess(function (event, xhr, settings) {";
        functionToInject += 'if (settings.url === "https://steamcommunity.com/tradeoffer/new/send") {';
        functionToInject += 'if (doAfterTrade === "CLOSE_WINDOW") { window.close();';
        functionToInject += '} else if (doAfterTrade === "CLICK_OK") {';
        functionToInject += 'document.querySelector("div.newmodal_buttons > div").click(); } } });';
        let script = document.createElement("script");
        script.appendChild(document.createTextNode(functionToInject));
        document.body.appendChild(script);
      }
      // send trade offer
      if (g_s.autoSend) {
        unsafeWindow.ToggleReady(true);
        unsafeWindow.CTradeOfferStateManager.ConfirmTradeOffer();
      }

      let notif = document.createElement("span");
      notif.setAttribute("style", "color:#00FF00; opacity:0; transition: opacity 3s;");
      notif.appendChild(document.createTextNode("(All cards added successfully)"));
      let anchor = document.getElementsByClassName("trade_partner_headline")[0] as HTMLElement;
      anchor.appendChild(notif);
      // Force a reflow so the opacity transition below animates.
      void window.getComputedStyle(notif).opacity;
      notif.style.opacity = "1";
      debugPrint("everything done");
    }

    function checkContexts(g_s: any, g_v: any): void {
      "use strict";
      let ready = 0;
      // check if Steam loaded everything needed
      g_v.Users.forEach(function (user: any) {
        if (user.rgContexts && user.rgContexts[753] && user.rgContexts[753][6]) {
          if (user.cLoadsInFlight === 0) {
            if (user.rgContexts[753][6].inventory) {
              ready += 1;
            } else {
              unsafeWindow.document.getElementById("trade_inventory_unavailable").show();
              unsafeWindow.document.getElementById("trade_inventory_pending").show();
              user.loadInventory(753, 6);
            }
          }
        }
      });

      if (ready === 2) {
        // select your inventory
        unsafeWindow.TradePageSelectInventory(g_v.Users[0], 753, "6");
        // set trade offer message
        (document.getElementById("trade_offer_note") as HTMLInputElement).value = g_s.tradeMessage;
        try {
          addCards(g_s, g_v);
        } catch (e) {
          // no matter what happens, restore old cookie
          restoreCookie(g_v.oldCookie);
          debugPrint(e);
        }
      } else {
        window.setTimeout(checkContexts, 500, g_s, g_v);
      }
    }

    function getUrlVars(): Record<string, string | undefined> {
      "use strict";
      let vars: Record<string, string | undefined> = {};
      let hashes = window.location.href.slice(window.location.href.indexOf("?") + 1).split("&");
      hashes.forEach(function (hash: string) {
        const parts = hash.split("=");
        vars[parts[0] as string] = parts[1];
      });
      return vars;
    }

    ///// STM functions /////

    try {
      if (window.location.href.includes("source=asfstm")) {
        LoadConfig();
        const params = LoadParams() as TradeParams & { cardNames: string[] };

        let vars = getUrlVars();

        if (vars.match === undefined) {
          throw new Error("missing url parameter");
        }
        let filter: number[] = [];
        if (vars.match === "all") {
          filter = params.filter;
        } else {
          // NB: the original compared against NaN here, which is
          // never true; preserved verbatim (no behavior change).
          // eslint-disable-next-line no-constant-condition
          if (false) {
            throw new Error("invalid url parameter");
          }
          filter.push(Number(vars.match));
        }

        let Cards: string[][] = [[], []];
        let matches = params.matches[vars.partner as string];
        if (matches === undefined) {
          throw new Error("no matches with this partner");
        }
        debugPrint(JSON.stringify(matches));
        for (let i = 0; i < filter.length; i++) {
          const appid = filter[i]!;

          if (matches[appid] === undefined) {
            //can happen, filter is just allowed appids, not necessaryly available on this bot.
            debugPrint("no such appid in matches: " + appid);
          } else {
            debugPrint("adding matches for appid: " + appid);
            Cards[0]! = Cards[0]!.concat(
              matches[appid]!.send.map((card: number) => decodeURIComponent(params.cardNames[card]!)),
            );
            Cards[1]! = Cards[1]!.concat(
              matches[appid]!.receive.map((card: number) => decodeURIComponent(params.cardNames[card]!)),
            );
          }
        }
        debugPrint(JSON.stringify(Cards));

        if (Cards[0]!.length !== Cards[1]!.length) {
          unsafeWindow.ShowAlertDialog(
            "Different items amount",
            "You've requested " +
              (Cards[0]!.length > Cards[1]!.length ? "less" : "more") +
              " items than you give. Script aborting.",
          );
          throw new Error("Different items amount on both sides");
        }

        if (Cards[0]!.length === 0) {
          throw new Error("nothing to add, exiting");
        }
        // clear cookie containing last opened inventory tab - prevents unwanted inventory loading (it will be restored later)
        let oldCookie = document.cookie.split("strTradeLastInventoryContext=")[1];
        if (oldCookie) {
          oldCookie = oldCookie.split(";")[0];
        }
        document.cookie = "strTradeLastInventoryContext=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/tradeoffer/";

        let Users = [unsafeWindow.UserYou, unsafeWindow.UserThem];
        let global_vars = { Users: Users, oldCookie: oldCookie, Cards: Cards };

        window.setTimeout(checkContexts, 500, globalSettings, global_vars);
      }
    } catch (e) {
      debugPrint(e);
    }
  }
})();
