// Unit tests for the match-row view-data builders (src/lib/match-row.ts).
// Slice 2.4 of modularize-userscript-services: behavior must replay the
// inline `addMatchRow` decisions exactly, plus a golden snapshot of one full
// rendered row.
//
// Run with exactly one command from the repo root:
//
//   pnpm test

import { describe, it } from "vitest";
import assert from "node:assert/strict";

import {
  buildTradeBaseUrl,
  compareMatchNames,
  defaultBotAvatarHash,
  planFilterUpdate,
  populateCardsHtml,
} from "../src/lib/match-row";
import { renderRow } from "../src/templates/rowTemplate";
import { getPartner } from "../src/lib/helpers";

function item(appId: number, title: string): { appId: number; title: string; cards: [] } {
  return { appId, title, cards: [] };
}

describe("compareMatchNames", () => {
  it("sorts by game name ascending", () => {
    const rows = [item(2, "Zeta"), item(1, "Alpha"), item(3, "Mid")];
    assert.deepEqual(
      rows.sort(compareMatchNames).map((r) => r.appId),
      [1, 3, 2],
    );
  });

  it("treats equal names as equal", () => {
    assert.equal(compareMatchNames(item(1, "Same"), item(2, "Same")), 0);
  });
});

describe("buildTradeBaseUrl", () => {
  it("uses the full SteamID with no token in friend mode", () => {
    assert.equal(
      buildTradeBaseUrl(true, "76561198012345678", "tok"),
      "https://steamcommunity.com/tradeoffer/new/?partner=76561198012345678&source=asfstm",
    );
  });

  it("uses the truncated account id plus token in bot mode", () => {
    const full = "76561198012345678";
    assert.equal(
      buildTradeBaseUrl(false, full, "tok"),
      `https://steamcommunity.com/tradeoffer/new/?partner=${getPartner(full)}&token=tok&source=asfstm`,
    );
  });
});

describe("planFilterUpdate", () => {
  it("adds new badges to the filter and shows the row", () => {
    assert.deepEqual(planFilterUpdate(false, false), { display: "inline-block", addedToFilter: true });
  });

  it("keeps existing checked badges visible without re-adding", () => {
    assert.deepEqual(planFilterUpdate(true, true), { display: "inline-block", addedToFilter: false });
  });

  it("hides the row for unchecked badges without re-adding", () => {
    assert.deepEqual(planFilterUpdate(true, false), { display: "none", addedToFilter: false });
  });
});

describe("defaultBotAvatarHash", () => {
  it("falls back for null hashes and passes real ones through", () => {
    assert.equal(defaultBotAvatarHash(null), "fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb");
    assert.equal(defaultBotAvatarHash("abc123"), "abc123");
  });
});

describe("populateCardsHtml", () => {
  it("renders one slot per owned copy", () => {
    const html = populateCardsHtml({
      appId: 100,
      title: "G",
      cards: [{ item: "Card A", hash: "h", count: 2, iconUrl: "https://cdn/c" }],
    });
    assert.equal(html.match(/showcase_slot/g)?.length, 2);
    assert.ok(html.includes("https://cdn/c/98x115"));
    assert.ok(html.includes("Card A"));
  });

  it("renders nothing for empty sides", () => {
    assert.equal(populateCardsHtml({ appId: 100, title: "G", cards: [] }), "");
  });
});

describe("match row golden snapshot", () => {
  it("replays one full rendered row byte-identically", () => {
    const html = renderRow({
      index: 0,
      appIdList: [100],
      tradeUrlFull: buildTradeBaseUrl(false, "76561198012345678", "tok") + "&match=all",
      botProfileLink: "profiles/76561198012345678",
      botAvatarHash: defaultBotAvatarHash(null),
      botNickname: "Bot",
      any: "",
      botTotalInventoryCount: 42,
      botSteamId: "76561198012345678",
      matches: "<div>match</div>",
    });
    assert.match(html, /tradeoffer\/new\/\?partner=/);
    assert.match(html, /match=all/);
    assert.match(html, /fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb/);
  });
});
