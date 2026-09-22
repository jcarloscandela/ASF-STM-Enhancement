// @vitest-environment happy-dom
//
// Harness suites for the trade-offer orchestration seam
// (src/lib/offer-writer.ts): readiness polling, planned selection applied to
// a canned trade page, and the filter-widget DOM. No network, no XHR.
//
// Run with exactly one command from the repo root:
//
//   pnpm test

import { describe, it } from "vitest";
import assert from "node:assert/strict";

import {
  assessTradeReadiness,
  formatShortfallMessage,
  isOneToOneTrade,
  planOfferSelection,
  type OfferPoolItem,
  type TradeReadinessUser,
} from "../src/lib/offer-writer";

function poolItem(name: string, id: string, tradable: boolean | 0 = true): OfferPoolItem {
  return {
    classid: "c",
    instanceid: "i",
    tradable: tradable as true,
    market_hash_name: name,
    type: "Trading Card",
    id,
    element: { elementId: id },
  };
}

function tradePage(): { yours: HTMLElement; theirs: HTMLElement } {
  document.body.innerHTML = `<div id="your_slots"></div><div id="their_slots"></div><div id="trade_offer_note"></div>`;
  return {
    yours: document.getElementById("your_slots")!,
    theirs: document.getElementById("their_slots")!,
  };
}

/** Applies planned moves the way `addCards` does via `MoveItemToTrade`. */
function applyMoves(slots: HTMLElement[], moves: Array<Array<{ id: string }>>): void {
  moves.forEach((sideMoves, side) => {
    sideMoves.forEach((move) => {
      const slot = document.createElement("div");
      slot.className = "has_item";
      slot.dataset.itemId = move.id;
      slots[side]!.appendChild(slot);
    });
  });
}

describe("assessTradeReadiness", () => {
  const loaded: TradeReadinessUser = { rgContexts: { 753: { 6: { inventory: {} } } }, cLoadsInFlight: 0 };
  const loading: TradeReadinessUser = { rgContexts: { 753: { 6: { inventory: {} } } }, cLoadsInFlight: 2 };
  const missing: TradeReadinessUser = { rgContexts: { 753: { 6: {} } }, cLoadsInFlight: 0 };
  const absent: TradeReadinessUser = {};

  it("reports 2 when both inventories are loaded", () => {
    assert.equal(assessTradeReadiness([loaded, loaded]), 2);
  });

  it("ignores sides still loading or without inventory", () => {
    assert.equal(assessTradeReadiness([loaded, loading]), 1);
    assert.equal(assessTradeReadiness([loaded, missing]), 1);
    assert.equal(assessTradeReadiness([absent, absent]), 0);
  });
});

describe("offer selection applied to a canned trade page", () => {
  it("fills both slot areas equally for match=all", () => {
    const { yours, theirs } = tradePage();
    const plan = planOfferSelection(
      [
        ["Card A", "Card C"],
        ["Card B", "Card D"],
      ],
      [
        [poolItem("Card A", "1"), poolItem("Card C", "2")],
        [poolItem("Card B", "3"), poolItem("Card D", "4")],
      ],
      "AS_IS",
    );
    assert.equal(plan.failLater, false);
    assert.equal(isOneToOneTrade(plan.cardTypes), true);
    applyMoves([yours, theirs], plan.moves);
    assert.equal(yours.querySelectorAll(".has_item").length, 2);
    assert.equal(theirs.querySelectorAll(".has_item").length, 2);
    assert.equal(yours.querySelectorAll(".has_item").length, theirs.querySelectorAll(".has_item").length);
  });

  it("leaves slots empty and flags when a held copy is the only copy", () => {
    const { yours, theirs } = tradePage();
    const plan = planOfferSelection(
      [["Card A"], ["Card B"]],
      [[poolItem("Card A", "1", 0)], [poolItem("Card B", "3")]],
      "AS_IS",
    );
    assert.equal(plan.failLater, true);
    applyMoves([yours, theirs], plan.moves);
    assert.equal(yours.querySelectorAll(".has_item").length, 0);
    assert.equal(theirs.querySelectorAll(".has_item").length, 1);
  });

  it("applies zero moves and names the cards when the user pool is short (6v6 repro)", () => {
    // Reported case: balanced 6-vs-6 handoff, user inventory supplies only 4.
    // addCards gates moves on shortfalls, so the offer stays empty and the
    // dialog names the missing cards instead of blaming the Params key.
    const requested: [string[], string[]] = [
      ["A1", "A2", "A3", "A4", "A5", "A6"],
      ["B1", "B2", "B3", "B4", "B5", "B6"],
    ];
    assert.equal(requested[0].length, requested[1].length);
    const plan = planOfferSelection(
      requested,
      [
        [poolItem("A1", "1"), poolItem("A2", "2"), poolItem("A3", "3"), poolItem("A4", "4")],
        [
          poolItem("B1", "11"),
          poolItem("B2", "12"),
          poolItem("B3", "13"),
          poolItem("B4", "14"),
          poolItem("B5", "15"),
          poolItem("B6", "16"),
        ],
      ],
      "AS_IS",
    );
    assert.equal(plan.failLater, true);
    assert.deepEqual(plan.shortfalls, [
      { side: 0, name: "A5", reason: "absent" },
      { side: 0, name: "A6", reason: "absent" },
    ]);
    // Gated application mirrors the reordered addCards: no moves on shortfall.
    const { yours, theirs } = tradePage();
    const dialogs: Array<[string, string]> = [];
    if (plan.failLater || plan.shortfalls.length > 0) {
      dialogs.push(["Items missing", formatShortfallMessage(plan.shortfalls)]);
    } else {
      applyMoves([yours, theirs], plan.moves);
    }
    assert.equal(yours.querySelectorAll(".has_item").length, 0);
    assert.equal(theirs.querySelectorAll(".has_item").length, 0);
    assert.equal(dialogs.length, 1);
    assert.match(dialogs[0]![1], /yours: A5 \(not in inventory\)/);
    assert.match(dialogs[0]![1], /yours: A6 \(not in inventory\)/);
    assert.doesNotMatch(dialogs[0]![1], /TempAsfStm\.ASF\.STM\.Params/);
  });
});

describe("filter widget DOM", () => {
  it("creates a checked filter entry with count 1", () => {
    const widget = document.createElement("div");
    widget.id = "asf_stm_filters_body";
    document.body.appendChild(widget);
    const appId = 100;
    const gameName = "Game X";
    const html = `<span style="margin-right: 15px; white-space: nowrap; display: inline-block;"><input type="checkbox" id="astm_${appId}" checked="" /><label for="astm_${appId}" data-count="1">${gameName} <b>(1)</b></label></span>`;
    const tpl = document.createElement("template");
    tpl.innerHTML = html.trim();
    widget.appendChild(tpl.content.firstChild!);
    const box = document.getElementById(`astm_${appId}`) as HTMLInputElement;
    assert.equal(box.checked, true);
    assert.equal(box.parentElement!.querySelector("label")!.dataset.count, "1");
    widget.remove();
  });
});
