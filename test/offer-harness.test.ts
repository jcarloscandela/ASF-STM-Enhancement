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
