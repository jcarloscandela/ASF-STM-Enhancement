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
import {
  buildMatchStore,
  computeMatches,
  resolvePartnerMatches,
  resolveTradeCards,
  resolveTradeFilter,
  tradePartnerKeyCandidates,
  type StoredMatchCards,
} from "./lib/matcher-core";
import { applyBadgeSetSizes, hasMatchableDistribution, parseGamecardsPage, sortBadgeCardsDesc } from "./lib/badge-page";
import {
  buildTradeBaseUrl,
  compareMatchNames,
  defaultBotAvatarHash,
  planFilterUpdate,
  populateCardsHtml,
} from "./lib/match-row";
import { getRandomOfferIndex, isOneToOneTrade, planOfferSelection, type OfferPoolItem } from "./lib/offer-writer";
import {
  buildRateLimitFailFastError,
  classifySteamError,
  RateLimitCircuitBreaker,
  type SteamErrorCategory,
} from "./lib/resilience";
import { buildBadgeFromCardList, buildInventoryCardCounts, buildScanEligibility } from "./lib/tradable";
import {
  buildScanResumeRecord,
  clearScanResume,
  readScanResume,
  writeScanResume,
  type ScanResumeRecord,
} from "./lib/scan-resume";
import {
  normalizeDataset,
  readBadgeCardCache,
  writeBadgeCardCacheEntry,
  type BadgeCardCache,
  type BadgeDataset,
} from "./lib/dataset";
import badgeCardsJson from "../data/badge_cards.json";
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
  // Scan-resume state (fix-badge-detail-phase-completion): the plan key
  // snapshots the resolved scan plan at click time; a validated record read
  // at the scan entry is consumed by GetOwnCards.
  let scanResumePlanKey = "";
  let pendingScanResume: ScanResumeRecord | undefined;
  // Single bundled dataset: rich card lists (hashes + titles + icon paths)
  // plus size-only entries folded in from the old counts export.
  let cardDataset: BadgeDataset = {};
  let badgeCardCache: BadgeCardCache = {};
  let remoteBadgeCardData: Record<string, BadgeCardInfo> | null = null;
  let scanRunId = 0;
  let stop = false;
  let botCacheTime = 5 * 60000;
  // Global circuit breaker over Steam scan requests: community rate limits
  // apply per session/IP, so one shared breaker gates all three request flows.
  const scanBreaker = new RateLimitCircuitBreaker();
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
    tradeParams.cardNames = Array.from(cardNames);
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

    if (globalSettings.sortByName) {
      itemsToSend.sort(compareMatchNames);
      itemsToReceive.sort(compareMatchNames);
    }

    const tradeUrl = buildTradeBaseUrl(
      globalSettings.matchFriends,
      bots!.Result[index]!.SteamID,
      bots!.Result[index]!.TradeToken,
    );
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

      //remove placeholder
      let filterWidget = document.getElementById("asf_stm_filters_body") as HTMLElement;
      let placeholder = document.getElementById("asf_stm_placeholder");
      if (placeholder !== null) {
        placeholder.parentNode!.removeChild(placeholder);
      }
      //add filter
      let checkBox = document.getElementById("astm_" + appId) as HTMLInputElement | null;
      // `planFilterUpdate` expects checkbox EXISTENCE (contract: !exists ->
      // addedToFilter), so pass `checkBox !== null`; with the argument
      // corrected, the missing-checkbox path only ever takes the add branch
      // below and can no longer reach the `checkBox.parentElement` read.
      const filterUpdate = planFilterUpdate(checkBox !== null, checkBox?.checked ?? true);
      let display = filterUpdate.display;
      if (filterUpdate.addedToFilter) {
        let newFilter = `<span style="margin-right: 15px; white-space: nowrap; display: inline-block;"><input type="checkbox" id="astm_${appId}" checked="" /><label for="astm_${appId}" data-count="1">${gameName} <b>(1)</b></label></span>`;
        let spanTemplate = document.createElement("template");
        spanTemplate.innerHTML = newFilter.trim();
        filterWidget.appendChild(spanTemplate.content.firstChild!);
        tradeParams.filter.push(Number(appId));
        SaveParams();
      } else {
        /* Increment match count */
        const label = checkBox!.parentElement!.querySelector("label") as HTMLElement;
        label.dataset.count = String(parseInt(label.dataset.count ?? "") + 1);
      }

      let sendResult = populateCardsHtml(itemsToSend[i]!);
      let receiveResult = populateCardsHtml(itemToReceive!);

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
    const rowAvatarHash = defaultBotAvatarHash(botEntry.AvatarHash);
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
    // Materialize the shared card-name table BEFORE resolving ids: on a fresh
    // scan tradeParams has no cardNames yet, and buildMatchStore would receive
    // undefined and throw, leaving matches unpersisted (empty trade offers).
    tradeParams.cardNames = Array.from(cardNames);
    const partner = getPartner(steamID);
    tradeParams.matches[partner] = buildMatchStore(itemsToSend, itemsToReceive, tradeParams.cardNames);
    // buildMatchStore appends unknown hashes to the array; sync the Set back
    // so the trailing SaveParams (and later ones in addMatchRow) persist them.
    cardNames = new Set(tradeParams.cardNames);
    SaveParams();
  }

  // Badge card data resolution: covered games (card list in the bundled
  // dataset or the browser card cache) derive their slots locally with zero
  // badge-detail requests; the rest are fetched serially - one
  // ajaxgetbadgeinfo request at a time, separated by the web limiter - and
  // learned into the browser cache. Parallel Steam requests are never made.
  function GetOwnCards(): void {
    debugPrint("GetOwnCards");

    // Scan state declared first: finish() reads `aborted`, and the
    // zero-pending fast path below returns via finish() before Phase 2.
    let pendingIndex = 0;
    let aborted = false;

    const pending: Array<{ appId: number; badge: Badge }> = [];

    // Resume: a validated record from an interrupted run restores the phase
    // state and skips Phase 1 (restored badges already carry their derived
    // state); anything that fails validation falls through to a fresh
    // derivation below.
    const resumeRecord = pendingScanResume;
    pendingScanResume = undefined;
    let resumed = false;
    if (resumeRecord !== undefined) {
      const restored: typeof pending = [];
      for (const appId of resumeRecord.pendingAppIds) {
        const badge = resumeRecord.myBadges.find((candidate) => candidate.appId === appId);
        if (badge === undefined) {
          restored.length = 0;
          break;
        }
        restored.push({ appId, badge });
      }
      if (restored.length === resumeRecord.pendingAppIds.length) {
        myBadges = resumeRecord.myBadges;
        inventoryCardCounts = resumeRecord.inventoryCardCounts;
        cardNames = new Set<string>();
        for (const badge of myBadges) {
          for (const card of badge.cards) {
            cardNames.add(card.hash);
          }
        }
        pending.push(...restored);
        pendingIndex = Math.min(resumeRecord.pendingIndex, pending.length);
        resumed = true;
        debugPrint(`resuming badge-detail phase at ${pendingIndex}/${pending.length}`);
      }
    }

    if (!resumed) {
      // Phase 1: derive every badge whose card list is already known.
      for (const badge of myBadges) {
        const cardList = resolveBadgeCardList(badge.appId);
        if (cardList === undefined) {
          pending.push({ appId: badge.appId, badge });
          continue;
        }
        const derived = buildBadgeFromCardList(
          badge.appId,
          resolveBadgeTitle(badge.appId),
          resolveBadgeSize(badge.appId) ?? cardList.length,
          cardList,
          inventoryCardCounts!,
        );
        if (derived === undefined) {
          // Data problem (size below five, or a card list disagreeing with the
          // set size): fetch the badge authoritatively instead of dropping it.
          pending.push({ appId: badge.appId, badge });
          continue;
        }
        Object.assign(badge, derived);
        for (const card of derived.cards) {
          cardNames.add(card.hash);
        }
      }
    }
    progressRadials.badges.steps = pending.length;
    progressRadials.badges.currentStep = 0;
    if (pending.length === 0) {
      finish();
      return;
    }

    // Phase 2: serial detail fetch - one request at a time, web-limiter paced.

    // Snapshots the in-flight phase (queue position + derived state) so a
    // crash or reload can resume it; written once at phase start and once
    // per completed entry, never on a retry.
    function saveResumeRecord(): void {
      if (scanResumePlanKey === "") {
        return;
      }
      writeScanResume(
        sessionStorage,
        buildScanResumeRecord({
          planKey: scanResumePlanKey,
          myBadges,
          inventoryCardCounts: inventoryCardCounts ?? {},
          pendingAppIds: pending.map((entry) => entry.appId),
          pendingIndex,
          badgesSteps: progressRadials.badges.steps,
        }),
      );
    }
    saveResumeRecord();

    function fillCards(
      badge: Badge,
      rgCards: Array<{ title: string; markethash: string; owned: number; imgurl: string }>,
    ): void {
      badge.maxCards = rgCards.length;
      // Idempotent fill: rebuild the slot list instead of appending, so a
      // resumed or retried entry can never duplicate cards.
      badge.cards = [];
      const perApp = inventoryCardCounts?.[badge.appId];
      for (let i = 0; i < rgCards.length; i++) {
        const card = rgCards[i]!;
        // Owned copies drive set progress and requests; the inventory counting
        // pass caps what this slot may offer. A game missing from the counting
        // pass leaves tradability unknown, and the matcher then treats every
        // copy as tradable.
        const newcard: MatchCard = {
          item: card.title,
          hash: card.markethash,
          count: card.owned,
          iconUrl: card.imgurl,
          number: i,
        };
        if (perApp !== undefined) {
          newcard.tradableCount = perApp[card.markethash]?.tradable ?? 0;
        }
        debugPrint(JSON.stringify(newcard));
        badge.cards.push(newcard);
        cardNames.add(card.markethash);
      }
    }

    function learnBadgeCards(badge: Badge): void {
      // A game's card list is static: persist it so later scans skip this
      // badge-detail request entirely.
      writeBadgeCardCacheEntry(localStorage, badgeCardCache, badge.appId, {
        size: badge.maxCards,
        cards: badge.cards.map((card) => ({ hash: card.hash, title: card.item, iconUrl: card.iconUrl })),
      });
    }

    function fetchNext(): void {
      if (aborted) {
        return;
      }
      if (stop) {
        stopEventCleanup("User interrupt");
        return;
      }
      // Completion guard: the pending queue is exhausted - hand off through the
      // same path as the zero-pending fast path instead of reading past the end
      // (`entry.appId` on undefined) or issuing another badge-detail request.
      if (pendingIndex >= pending.length) {
        finish();
        return;
      }
      // Circuit breaker gate: while Steam is rate-limiting, fail fast with a
      // retryable cooldown error instead of hammering the endpoint.
      const detailGate = scanBreaker.check();
      if (!detailGate.allowed) {
        const failFast = buildRateLimitFailFastError(detailGate.remainingMs);
        debugPrint(failFast.message);
        stopEventCleanup(failFast.message);
        aborted = true;
        return;
      }
      const entry = pending[pendingIndex]!;
      let url = "https://steamcommunity.com/" + myProfileLink + "/ajaxgetbadgeinfo/" + entry.appId + "?l=english";
      let xhr = new XMLHttpRequest();
      xhr.open("GET", url, true);
      xhr.responseType = "json";
      // eslint-disable-next-line
      xhr.onload = function () {
        if (stop) {
          stopEventCleanup("User interrupt");
          return;
        }
        let status = xhr.status;
        if (status === 200) {
          scanBreaker.recordSuccess();
        } else if (classifySteamError(status, null) === "RateLimited") {
          // Rate-limit window: record the failure and surface the cooldown
          // instead of hammering the endpoint with retries.
          scanBreaker.recordRateLimited();
          const cooldownGate = scanBreaker.check();
          const failFast = buildRateLimitFailFastError(cooldownGate.remainingMs);
          debugPrint(failFast.message);
          stopEventCleanup(failFast.message);
          aborted = true;
          return;
        } else if (status === 401 || status === 403) {
          stopEventCleanup(`Badge data fetch error: ${entry.appId}`);
          aborted = true;
          return;
        }
        if (status === 200) {
          try {
            if (Object.keys(xhr.response).length === 1) {
              // invalid badge: drop it and move on
              debugPrint(`invalid badge ${entry.appId}`);
              const index = myBadges.indexOf(entry.badge);
              if (index !== -1) {
                myBadges.splice(index, 1);
              }
              pendingIndex++;
              updateProgress("badges");
              saveResumeRecord();
              setTimeout(fetchNext, globalSettings.weblimiter);
              return;
            }
            debugPrint("processing badge " + entry.appId);
            if (xhr.response != undefined && xhr.response.eresult == 1) {
              if (xhr.response.badgedata.rgCards.length >= 5) {
                errors = 0;
                fillCards(entry.badge, xhr.response.badgedata.rgCards);
                learnBadgeCards(entry.badge);
                pendingIndex++;
                updateProgress("badges");
                saveResumeRecord();
                setTimeout(fetchNext, globalSettings.weblimiter);
                return;
              } else {
                debugPrint("less than 5 cards in a badge - something is wrong");
                debugPrint(JSON.stringify(xhr.response));
                errors++;
              }
            } else {
              if (xhr.response != undefined) {
                debugPrint("eresult = " + xhr.response.eresult);
              }
              stopEventCleanup(`Badge data fetch error: ${entry.appId}`);
              aborted = true;
              return;
            }
          } catch (error) {
            debugPrint(error);
            debugPrint(JSON.stringify(xhr.response));
            errors++;
          }
        } else {
          errors++;
        }
        if ((status < 400 || status >= 500) && errors <= globalSettings.maxErrors) {
          setTimeout(
            function () {
              fetchNext();
            },
            retryDelay(globalSettings, errors),
          );
        } else {
          if (status !== 200) {
            debugPrint(`Error getting badge data: ${status}`);
          } else {
            debugPrint("Error getting own badge data, wrong badge " + entry.appId);
          }
          stopEventCleanup(`Error getting badge data: ${status}`);
          aborted = true;
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
            function () {
              fetchNext();
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

    function finish(): void {
      if (aborted) {
        return;
      }
      // Phase/scan completion: no resume record may survive it.
      clearScanResume(sessionStorage);
      debugPrint("populated");

      debugTime("Filter and sort");
      for (let i = myBadges.length - 1; i >= 0; i--) {
        debugPrint("badge " + i + JSON.stringify(myBadges[i]!));

        sortBadgeCardsDesc(myBadges[i]!);
        if (!hasMatchableDistribution(myBadges[i]!)) {
          //nothing to match, remove from list.
          myBadges.splice(i, 1);
          continue;
        }

        const totalCards = applyBadgeSetSizes(myBadges[i]!);
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

    fetchNext();
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

      let url = `https://steamcommunity.com/${idLink ?? profileLink}/gamecards/${botBadges[index]!.appId}?l=english`;
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
          scanBreaker.recordSuccess();
        }
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
          const parseResult = parseGamecardsPage(xhr.response.documentElement, myBadges[index]!.cards);
          if (parseResult.kind !== "too-few") {
            errors = 0;
            if (parseResult.kind === "ok") {
              botBadges[index]!.maxCards = parseResult.maxCards;
              for (const parsed of parseResult.cards) {
                debugPrint(JSON.stringify(parsed));
                botBadges[index]!.cards.push(parsed);
              }
            }
            if (parseResult.kind === "unmatched") {
              debugPrint(
                `Card "${parseResult.unmatched}" not found in badge ${botBadges[index]!.appId}, skipping badge for this partner`,
              );
              botBadges.splice(index, 1);
              myBadges.splice(index, 1);
              progressRadials.botBadges.currentStep--;
              idLink ??= xhr.responseURL.match(/(id\/.+?)\//)?.[1];
              setTimeout(
                (function (index, userindex, idLink) {
                  return function () {
                    GetCards(index, userindex, idLink);
                  };
                })(index, userindex, idLink),
                globalSettings.weblimiter,
              );
              return;
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
          if (classifySteamError(status, null) === "RateLimited") {
            // Rate-limit window: record the failure and surface the cooldown
            // instead of hammering the endpoint with retries.
            scanBreaker.recordRateLimited();
            const cooldownGate = scanBreaker.check();
            const failFast = buildRateLimitFailFastError(cooldownGate.remainingMs);
            debugPrint(failFast.message);
            stopEventCleanup(failFast.message);
            return;
          }
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
      // Circuit breaker gate: while Steam is rate-limiting, fail fast with a
      // retryable cooldown error instead of hammering the endpoint.
      const botGate = scanBreaker.check();
      if (!botGate.allowed) {
        const failFast = buildRateLimitFailFastError(botGate.remainingMs);
        debugPrint(failFast.message);
        stopEventCleanup(failFast.message);
        return;
      }
      xhr.send();
      return; //do this synchronously to avoid rate limit
    }
    debugPrint("populated");

    debugTime("Filter and sort");
    for (let i = botBadges.length - 1; i >= 0; i--) {
      debugPrint("badge " + i + JSON.stringify(botBadges[i]!));

      sortBadgeCardsDesc(botBadges[i]!);
      const totalCards = applyBadgeSetSizes(botBadges[i]!);
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

      // Rate-limit circuit breaker: an open breaker fails fast with a
      // retryable error instead of hammering a throttled endpoint.
      const gate = scanBreaker.check();
      if (!gate.allowed) {
        throw buildRateLimitFailFastError(gate.remainingMs);
      }

      const url: string = startAssetId ? `${baseUrl}&start_assetid=${startAssetId}` : baseUrl;

      let data: any;
      let pageError: Error | null = null;
      let pageCategory: SteamErrorCategory = "Unknown";
      try {
        const response: Response = await fetch(url);
        if (!response.ok) {
          const bodyText = await response.text().catch(() => null);
          pageCategory = classifySteamError(response.status, bodyText);
          pageError = new Error(`HTTP Error ${response.status}`);
        } else {
          try {
            data = await response.json();
            scanBreaker.recordSuccess();
          } catch {
            pageCategory = "Unknown";
            pageError = new Error("Inventory response was not valid JSON");
          }
        }
      } catch (error) {
        // Network-level failure (fetch rejection): transport errors are
        // transient by definition.
        pageCategory = "Transient";
        pageError = error instanceof Error ? error : new Error(String(error));
      }

      if (pageError !== null) {
        if (pageCategory === "RateLimited") {
          scanBreaker.recordRateLimited();
        }
        if (pageCategory === "Auth" || pageCategory === "Unknown") {
          throw pageError;
        }
        // Rate-limited and transient page failures retry within the error
        // budget; a fresh breaker gate re-checks before the next attempt.
        errors++;
        if (errors > globalSettings.maxErrors) {
          throw pageError;
        }
        await sleep(retryDelay(globalSettings, errors));
        continue;
      }

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

  // Per-game badge data resolution: single bundled dataset -> browser
  // cache -> the lazily fetched remote badges database.
  function resolveBadgeSize(appId: number): number | undefined {
    return (
      cardDataset[String(appId)]?.size ?? badgeCardCache[String(appId)]?.size ?? remoteBadgeCardData?.[appId]?.size
    );
  }

  function resolveBadgeTitle(appId: number): string {
    return (
      cardDataset[String(appId)]?.name ??
      remoteBadgeCardData?.[appId]?.name ??
      badgeCardCache[String(appId)]?.name ??
      `AppID ${appId}`
    );
  }

  function resolveBadgeCardList(appId: number): Array<{ hash: string; title?: string; iconUrl?: string }> | undefined {
    // The bundled dataset carries full card objects (hash + title + iconUrl)
    // for rich entries and hashes only for folded-in counts entries, and is
    // returned verbatim. The badge title has no bundled source (the file
    // carries card titles, not badge names), so `resolveBadgeTitle` keeps its
    // existing order.
    return cardDataset[String(appId)]?.cards ?? badgeCardCache[String(appId)]?.cards;
  }

  // Badge-card data (size + title) resolved from the single bundled dataset,
  // the browser cache, and the lazily fetched remote badges database.
  function resolvedBadgeCardData(): Record<string, BadgeCardInfo> {
    const resolved: Record<string, BadgeCardInfo> = {};
    for (const [appId, entry] of Object.entries(cardDataset)) {
      resolved[appId] = { size: entry.size, name: entry.name ?? `AppID ${appId}` };
    }
    for (const [appId, entry] of Object.entries(badgeCardCache)) {
      if (resolved[appId] === undefined && entry.size !== undefined) {
        resolved[appId] = { size: entry.size, name: entry.name ?? `AppID ${appId}` };
      }
    }
    if (remoteBadgeCardData !== null) {
      for (const [appId, info] of Object.entries(remoteBadgeCardData)) {
        if (resolved[appId] === undefined) {
          resolved[appId] = info;
        }
      }
    }
    return resolved;
  }

  async function getBadgesInventory(inventoryData: InventoryData, runId: number, scanPlan: ScanPlan): Promise<void> {
    inventoryCardCounts = buildInventoryCardCounts(inventoryData);

    // Candidate games: every game with counted cards, plus scan-filter games.
    const candidateAppIds = new Set<number>();
    for (const appId of Object.keys(inventoryCardCounts)) {
      candidateAppIds.add(Number(appId));
    }
    if (scanPlan.mode === "filters") {
      for (const filter of globalSettings.scanFilters) {
        if (filter.active) {
          candidateAppIds.add(Number(filter.appId));
        }
      }
    }

    // Set sizes resolve from the bundled dataset and the browser cache first;
    // the remote badges database is fetched lazily, once, only if something
    // is still unknown.
    const needsDatabase = [...candidateAppIds].some((appId) => resolveBadgeSize(appId) === undefined);
    if (needsDatabase) {
      const request = resolveRequestFunction({ legacyRequest: GM_xmlhttpRequest, modernApi: GM });
      const text = await gmGet(request, {
        url: "https://raw.githubusercontent.com/nolddor/steam-badges-db/main/data/badges.min.json",
      });
      remoteBadgeCardData = JSON.parse(text) as Record<string, BadgeCardInfo>;
      if (runId !== undefined && (runId !== scanRunId || stop)) {
        return; // superseded by a newer scan run
      }
    }

    if (processFilters(scanPlan)) {
      return;
    }

    const scanResult = buildScanEligibility(inventoryCardCounts, resolvedBadgeCardData());

    /* Push badge stub to myBadges list */
    for (const appId of candidateAppIds) {
      if (scanResult[String(appId)]!.unbalanced) {
        myBadges.push({
          appId,
          title: resolveBadgeTitle(appId),
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
    // Stop or abort: no in-flight resume record may survive it, so the next
    // scan starts fresh (a crash never reaches this function, which is what
    // leaves the record available for resume).
    clearScanResume(sessionStorage);
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
    // Resume decision: a version- and plan-validated record from an
    // interrupted badge-detail phase continues that phase in GetOwnCards;
    // every mismatch degrades silently to a fresh scan.
    scanResumePlanKey = JSON.stringify(scanPlan);
    pendingScanResume = readScanResume(sessionStorage, scanResumePlanKey);
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
    cardDataset = normalizeDataset(badgeCardsJson);
    badgeCardCache = readBadgeCardCache(localStorage);
    remoteBadgeCardData = null;
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
      const pools = [0, 1].map((i: number) => {
        const live = g_v.Users[i].rgContexts[753][6].inventory;
        live.BuildInventoryDisplayElements();
        return Object.values(live.rgInventory) as OfferPoolItem[];
      });
      const plan = planOfferSelection(g_v.Cards, pools, g_s.order, getRandomOfferIndex);
      plan.moves.forEach(function (sideMoves) {
        sideMoves.forEach(function (move) {
          unsafeWindow.MoveItemToTrade(move.element);
        });
      });
      const failLater = plan.failLater;

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
      if (!isOneToOneTrade(plan.cardTypes)) {
        unsafeWindow.ShowAlertDialog("Not 1:1 trade", "This is not a valid 1:1 trade. Script aborting.");
        throw "Not 1:1 trade";
      }
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
          // Loud failure: the handoff resolved but items could not be
          // selected (e.g. inventory not matching). Never fail silently.
          try {
            const message = e instanceof Error ? e.message : String(e);
            unsafeWindow.ShowAlertDialog(
              "ASF-STM trade setup failed",
              "Could not add the matched cards to the trade offer: " +
                message +
                ". Open DevTools console and check localStorage key TempAsfStm.ASF.STM.Params (matches/filter/cardNames).",
            );
          } catch {
            /* dialogs unavailable - debug log above is the fallback */
          }
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

        // Handoff resolution lives in lib/matcher-core (pure, fixture-tested):
        // match=all selects the persisted filter, match=<appid> one badge;
        // partner accepts raw, truncated, and twice-truncated keys.
        const partnerKey = vars.partner as string;
        debugPrint("trade partner keys tried: " + JSON.stringify(tradePartnerKeyCandidates(partnerKey, getPartner)));
        const filter = resolveTradeFilter(vars.match, params.filter);
        debugPrint("trade appid filter: " + JSON.stringify(filter));
        let matches: Record<string, StoredMatchCards>;
        try {
          matches = resolvePartnerMatches(params.matches, partnerKey, getPartner);
        } catch {
          throw new Error("no matches with this partner");
        }
        debugPrint(JSON.stringify(matches));
        const onSkipCard = (card: number): void => {
          debugPrint("skipping unknown card id: " + card);
        };
        let Cards: string[][] = resolveTradeCards(matches, filter, params.cardNames, onSkipCard);
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
      try {
        const message = e instanceof Error ? e.message : String(e);
        unsafeWindow.ShowAlertDialog(
          "ASF-STM trade setup failed",
          "Could not prepare the trade offer: " +
            message +
            ". Open DevTools console and check localStorage key TempAsfStm.ASF.STM.Params (matches/filter/cardNames).",
        );
      } catch {
        /* dialogs unavailable - debug log above is the fallback */
      }
    }
  }
})();
