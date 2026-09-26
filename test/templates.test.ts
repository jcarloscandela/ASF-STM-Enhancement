// Unit tests for the HTML template renderers (src/templates/*).
//
// The renderers interpolate pre-sanitized values verbatim: untrusted content
// (bot nicknames) is escaped by the caller via sanitizeNickname before it
// reaches the templates, so these tests pin verbatim passthrough alongside
// structure. Any output diff is a failure, never an update.
//
// Run with exactly one command from the repo root:
//
//   pnpm test

import { readFileSync } from "node:fs";
import { describe, it } from "vitest";
import assert from "node:assert/strict";

import { renderConfigDialog, type ConfigDialogSettings } from "../src/templates/configDialogTemplate";
import { renderMainContent } from "../src/templates/mainContentTemplate";
import { renderMatch } from "../src/templates/matchTemplate";
import { renderRow } from "../src/templates/rowTemplate";
import { renderScanFilterElement } from "../src/templates/scanFilterTemplate";
import { sanitizeNickname } from "../src/lib/helpers";

function settings(overrides: Partial<ConfigDialogSettings> = {}): ConfigDialogSettings {
  return {
    matchFriends: false,
    anyBots: true,
    fairBots: true,
    botMinItems: 0,
    botMaxItems: 0,
    sortByName: false,
    preventClose: false,
    debug: false,
    weblimiter: 1000,
    errorLimiter: 5000,
    maxErrors: 5,
    inventoryScanDelay: 300,
    tradeMessage: "hello",
    doAfterTrade: "NOTHING",
    order: "SORT",
    autoSend: false,
    useScanFilters: false,
    autoAddScanFilters: false,
    autoDeleteScanFilters: false,
    ...overrides,
  };
}

const CONFIG_ARGS = {
  filterBG: ["#171a21", 0.8] as [string, number],
  questionmarkURL: "https://example.test/q.png",
  sortSelectsHtml: "<select></select>",
  blacklistText: "123",
  scanFiltersTemplate: "<span></span>",
};

describe("renderMatch", () => {
  it("renders badge structure with ids, links, and slots", () => {
    const html = renderMatch({
      appId: 440,
      display: "inline-block",
      myProfileLink: "profiles/1",
      gameName: "Game",
      tradeUrlApp: "https://trade.example/?match=440",
      sendResult: "<div>send</div>",
      botProfileLink: "profiles/2",
      botNickname: "SomeBot",
      receiveResult: "<div>receive</div>",
    });
    assert.match(html, /class="asf_stm_appid_440"/);
    assert.match(html, /style="display:inline-block"/);
    assert.match(html, /profiles\/1\/gamecards\/440\//);
    assert.match(html, /profiles\/2\/gamecards\/440\//);
    assert.match(html, /capsule_184x69\.jpg/);
    assert.match(html, /Offer a trade/);
    assert.match(html, /<div>send<\/div>/);
    assert.match(html, /<div>receive<\/div>/);
    assert.match(html, /SomeBot/);
  });

  it("pastes pre-sanitized nicknames verbatim without further escaping", () => {
    const html = renderMatch({
      appId: 440,
      display: "inline-block",
      myProfileLink: "profiles/1",
      gameName: "Game",
      tradeUrlApp: "https://trade.example/?match=440",
      sendResult: "",
      botProfileLink: "profiles/2",
      botNickname: sanitizeNickname(`<b>"Bob" & 'Alice'</b>`),
      receiveResult: "",
    });
    assert.match(html, /&lt;b&gt;&quot;Bob&quot; &amp; &#x27;Alice&#x27;&lt;&#x2F;b&gt;/);
    assert.doesNotMatch(html, /<b>"Bob"/);
  });

  it("renders raw markup verbatim when the caller skips sanitizing", () => {
    // Documents the pipeline contract: templates never escape, so every
    // untrusted value must pass sanitizeNickname at the call site first.
    const html = renderMatch({
      appId: 440,
      display: "inline-block",
      myProfileLink: "profiles/1",
      gameName: "Game",
      tradeUrlApp: "https://trade.example/?match=440",
      sendResult: "",
      botProfileLink: "profiles/2",
      botNickname: `<img src=x onerror=alert(1)>`,
      receiveResult: "",
    });
    assert.match(html, /<img src=x onerror=alert\(1\)>/);
  });
});

describe("renderRow", () => {
  function rowData(overrides: Record<string, unknown> = {}) {
    return {
      index: 3,
      appIdList: [440, 570],
      tradeUrlFull: "https://trade.example/?match=all",
      botProfileLink: "profiles/2",
      botAvatarHash: "abc123",
      botNickname: "SomeBot",
      any: "&nbsp;ANY&nbsp;",
      botTotalInventoryCount: 42,
      botSteamId: "76561198000000001",
      matches: "<div>matches</div>",
      ...overrides,
    };
  }

  it("renders row structure with ids, urls, and counts", () => {
    const html = renderRow(rowData());
    assert.match(html, /id="asfstmbot_3"/);
    assert.match(html, /data-appids="440,570"/);
    assert.match(html, /href="https:\/\/trade\.example\/\?match=all"/);
    assert.match(html, /avatars\.cloudflare\.steamstatic\.com\/abc123\.jpg/);
    assert.match(html, /\(42 items\)/);
    assert.match(html, /id="blacklist_76561198000000001"/);
    assert.match(html, /<div>matches<\/div>/);
  });

  it("falls back to the default avatar hash for null avatars", () => {
    const html = renderRow(rowData({ botAvatarHash: null }));
    assert.match(html, /fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb\.jpg/);
  });

  it("pastes pre-sanitized nicknames verbatim", () => {
    const html = renderRow(rowData({ botNickname: sanitizeNickname(`<b>"Bob"</b>`) }));
    assert.match(html, /&lt;b&gt;&quot;Bob&quot;&lt;&#x2F;b&gt;/);
    assert.doesNotMatch(html, /<b>"Bob"<\/b>/);
  });
});

describe("renderMainContent", () => {
  it("renders progress radials and bot labels", () => {
    const html = renderMainContent({
      firstRadialName: "Inventory",
      matchFriends: false,
      filterBackgroundColor: "#171a21",
    });
    for (const id of ["scan-pages-radial", "scan-badges-radial", "scan-bots-radial", "bots-badges-radial"]) {
      assert.match(html, new RegExp(`id="${id}"`));
    }
    assert.match(html, />Bots</);
    assert.match(html, />Bot Badges</);
    assert.match(html, /background:#171a21/);
    for (const id of ["asf_stm_filter_all", "asf_stm_filter_none", "asf_stm_filter_invert", "asf_stm_filters_button"]) {
      assert.match(html, new RegExp(`id="${id}"`));
    }
  });

  it("renders friend labels in friend mode", () => {
    const html = renderMainContent({
      firstRadialName: "Inventory",
      matchFriends: true,
      filterBackgroundColor: "#000000",
    });
    assert.match(html, />Friends</);
    assert.match(html, />Friend Badges</);
  });
});

describe("renderConfigDialog", () => {
  it("renders tabs, checkbox states, and numeric settings", () => {
    const html = renderConfigDialog(
      settings({ matchFriends: true, debug: true, weblimiter: 1500 }),
      CONFIG_ARGS.filterBG,
      CONFIG_ARGS.questionmarkURL,
      CONFIG_ARGS.sortSelectsHtml,
      CONFIG_ARGS.blacklistText,
      CONFIG_ARGS.scanFiltersTemplate,
    );
    for (const id of ["asf_stm_tab1", "asf_stm_tab2", "asf_stm_tab3", "asf_stm_tab4"]) {
      assert.match(html, new RegExp(`id="${id}"`));
    }
    assert.match(html, /id="matchFriends"[^>]*checked/);
    assert.match(html, /id="debug"[^>]*checked/);
    assert.match(html, /id="weblimiter" value=1500/);
    assert.match(html, /<select><\/select>/);
    assert.match(html, /<span><\/span>/);
    assert.match(html, /https:\/\/example\.test\/q\.png/);
  });

  it("leaves checkboxes unchecked by default and selects the configured order", () => {
    const html = renderConfigDialog(
      settings(),
      CONFIG_ARGS.filterBG,
      CONFIG_ARGS.questionmarkURL,
      CONFIG_ARGS.sortSelectsHtml,
      CONFIG_ARGS.blacklistText,
      CONFIG_ARGS.scanFiltersTemplate,
    );
    assert.doesNotMatch(html, /id="matchFriends"[^>]*checked/);
    assert.match(html, /<option value="SORT" selected>Sorted<\/option>/);
    assert.match(html, /<option value="NOTHING" selected>Do Nothing<\/option>/);
  });

  it("pastes blacklist text verbatim", () => {
    const html = renderConfigDialog(
      settings(),
      CONFIG_ARGS.filterBG,
      CONFIG_ARGS.questionmarkURL,
      CONFIG_ARGS.sortSelectsHtml,
      "111\n222",
      CONFIG_ARGS.scanFiltersTemplate,
    );
    assert.match(html, /111\n222/);
  });
});

describe("css bundle", () => {
  it("ships non-empty CSS with the known selectors", () => {
    const css = readFileSync(new URL("../src/templates/css.css", import.meta.url), "utf8");
    assert.ok(css.length > 0);
    assert.match(css, /#asf_stm_filters_body/);
    assert.match(css, /\.asf_stm_tabs/);
  });
});

describe("renderScanFilterElement", () => {
  it("renders the active variant byte-identically", () => {
    assert.equal(
      renderScanFilterElement(true, 440, "Game", "profiles/1"),
      `<div id="scan-filter-440" class="friendBlock" style="cursor: auto;">` +
        `<div class="playerAvatar ingame">` +
        `<a target="_blank" rel="noopener noreferrer" href="https://steamcommunity.com/profiles/1/gamecards/440/">` +
        `<img class="stretch" src="https://steamcdn-a.akamaihd.net/steam/apps/440/capsule_184x69.jpg">` +
        `</a></div>` +
        `<div id="scan-filter-name-440" class="friendBlockContent">Game<br>` +
        `<input type="checkbox" data-app-id="440" checked></div></div>`,
    );
  });

  it("renders the inactive variant with offline avatar and unchecked box", () => {
    const html = renderScanFilterElement(false, "570", "Other Game", "profiles/9");
    assert.match(html, /class="playerAvatar offline"/);
    assert.match(html, /id="scan-filter-570"/);
    assert.match(html, /id="scan-filter-name-570"/);
    assert.match(html, /data-app-id="570" >/);
    assert.match(html, /profiles\/9\/gamecards\/570\//);
    assert.doesNotMatch(html, /checked/);
  });
});
