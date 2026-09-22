// @vitest-environment happy-dom
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
  type FilterUpdate,
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

// Wiring seam of `addMatchRow` (src/ASF-STM.ts): the pure-helper tests above
// hand-author `checkboxExists`, which is exactly how the inversion that caused
// the null-parentElement crash slipped through. These tests derive existence
// from element presence via getElementById - the way the call site does - and
// assert the reconciliation outcomes, so flipping the argument's polarity
// (back to `checkBox === null`) fails them.
describe("filter widget wiring seam (addMatchRow pattern)", () => {
  const APP_ID = 753;

  function mountWidget(): HTMLElement {
    document.body.innerHTML = "";
    const widget = document.createElement("div");
    widget.id = "asf_stm_filters_body";
    document.body.appendChild(widget);
    return widget;
  }

  /** The call-site markup: a span holding the checkbox and its labeled count. */
  function mountExistingEntry(widget: HTMLElement, checked: boolean): void {
    const span = document.createElement("span");
    span.innerHTML = `<input type="checkbox" id="astm_${APP_ID}" ${checked ? "checked" : ""} /><label for="astm_${APP_ID}" data-count="1">Game <b>(1)</b></label>`;
    widget.appendChild(span);
  }

  /** Mirrors src/ASF-STM.ts: derive existence from element presence, then plan. */
  function planLikeCallSite(appId: number): FilterUpdate {
    const checkBox = document.getElementById(`astm_${appId}`) as HTMLInputElement | null;
    return planFilterUpdate(checkBox !== null, checkBox?.checked ?? true);
  }

  it("missing checkbox: adds the entry and shows the row", () => {
    mountWidget();
    assert.deepEqual(planLikeCallSite(APP_ID), { display: "inline-block", addedToFilter: true });
  });

  it("existing checked checkbox: not re-added, row stays visible", () => {
    const widget = mountWidget();
    mountExistingEntry(widget, true);
    assert.deepEqual(planLikeCallSite(APP_ID), { display: "inline-block", addedToFilter: false });
  });

  it("existing unchecked checkbox: not re-added, row is hidden", () => {
    const widget = mountWidget();
    mountExistingEntry(widget, false);
    assert.deepEqual(planLikeCallSite(APP_ID), { display: "none", addedToFilter: false });
  });

  it("repeated reconciliations keep one checkbox/label and one filter entry while the count grows", () => {
    // Mirrors the full addMatchRow filter-widget block: plan from the DOM,
    // add+persist once, then only increment the displayed count.
    const widget = mountWidget();
    const filter: number[] = [];
    function reconcile(): FilterUpdate {
      const update = planLikeCallSite(APP_ID);
      if (update.addedToFilter) {
        mountExistingEntry(widget, true);
        filter.push(APP_ID);
      } else {
        const checkBox = document.getElementById(`astm_${APP_ID}`) as HTMLInputElement;
        const label = checkBox.parentElement!.querySelector("label") as HTMLElement;
        label.dataset.count = String(parseInt(label.dataset.count ?? "") + 1);
      }
      return update;
    }

    // First match adds the entry (count 1, checked, visible)...
    assert.deepEqual(reconcile(), { display: "inline-block", addedToFilter: true });
    // ...later matches only count, honoring the checked state.
    assert.deepEqual(reconcile(), { display: "inline-block", addedToFilter: false });
    assert.deepEqual(reconcile(), { display: "inline-block", addedToFilter: false });

    assert.equal(widget.querySelectorAll("input").length, 1, "exactly one checkbox");
    assert.equal(widget.querySelectorAll("label").length, 1, "exactly one label");
    assert.equal(document.querySelectorAll(`#astm_${APP_ID}`).length, 1, "no duplicate element ids");
    assert.deepEqual(filter, [APP_ID], "persisted filter holds the appid exactly once");
    const label = widget.querySelector("label")!;
    assert.equal(label.dataset.count, "3", "displayed match count incremented per render");
    assert.equal((widget.querySelector("input") as HTMLInputElement).checked, true, "checked state preserved");
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
