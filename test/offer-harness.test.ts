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
  retryUnselectableCopies,
  type LiveRetryDeps,
  type OfferPoolItem,
  type RawOfferPoolItem,
  type TradeReadinessUser,
  type UnsuppliedCard,
} from "../src/lib/offer-writer";
import { getPartner } from "../src/lib/helpers";
import { diagnoseTradeHandoff, formatTradeSetupMessage, resolveTradeCards } from "../src/lib/matcher-core";

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

function heldPoolItem(name: string, id: string): OfferPoolItem {
  // Future "Tradable After" hold with an allowing flag: held via hold text.
  return {
    ...poolItem(name, id, true),
    descriptions: [{ value: "Tradable After 26/09/2099, 09:00:00" }],
  };
}

/** Raw Steam trade-page pool entry: name/verdict fields live on the nested
 *  `description` (CInventoryItem shape), not top-level. The planner must
 *  normalize this into a selectable copy. */
function livePoolItem(name: string, assetid: string, tradable: boolean | 0, holdValue?: string): RawOfferPoolItem {
  const description: Record<string, unknown> = {
    market_hash_name: name,
    tradable,
    type: "Trading Card",
  };
  if (holdValue !== undefined) {
    description["descriptions"] = [{ value: holdValue }];
  }
  return {
    assetid,
    classid: "c",
    instanceid: "i",
    description,
    element: { elementId: assetid },
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

  it("selects the tradable copy when held copies share the same name (SORT)", () => {
    // User repro: owned 3 with 2 temporally blocked — the offer must use the
    // tradable copy instead of failing.
    const plan = planOfferSelection(
      [["Card A"], ["Card B"]],
      [[poolItem("Card A", "1", 0), heldPoolItem("Card A", "2"), poolItem("Card A", "3")], [poolItem("Card B", "4")]],
      "SORT",
    );
    assert.equal(plan.failLater, false);
    assert.deepEqual(plan.shortfalls, []);
    assert.equal(plan.moves[0]!.length, 1);
    assert.equal(plan.moves[0]![0]!.id, "3");
  });

  it("selects the tradable copy at any id position (SORT)", () => {
    // The tradable copy must win regardless of asset-id order: held copies
    // with higher ids must never shadow it.
    const cases: Array<{ pool: OfferPoolItem[]; expectedId: string }> = [
      {
        pool: [poolItem("Card A", "1"), poolItem("Card A", "2", 0), heldPoolItem("Card A", "3")],
        expectedId: "1",
      },
      {
        pool: [poolItem("Card A", "1", 0), poolItem("Card A", "2"), heldPoolItem("Card A", "3")],
        expectedId: "2",
      },
      {
        pool: [poolItem("Card A", "1", 0), heldPoolItem("Card A", "2"), poolItem("Card A", "3")],
        expectedId: "3",
      },
    ];
    for (const { pool, expectedId } of cases) {
      const plan = planOfferSelection([["Card A"], ["Card B"]], [pool, [poolItem("Card B", "4")]], "SORT");
      assert.equal(plan.failLater, false);
      assert.deepEqual(plan.shortfalls, []);
      assert.equal(plan.moves[0]!.length, 1);
      assert.equal(plan.moves[0]![0]!.id, expectedId);
    }
  });

  it("selects the tradable copy at any id position (RANDOM)", () => {
    // RANDOM draws from tradable copies only, so index 0 always resolves to
    // the single tradable copy no matter where it sits by id.
    const cases: Array<{ pool: OfferPoolItem[]; expectedId: string }> = [
      {
        pool: [poolItem("Card A", "1"), poolItem("Card A", "2", 0), heldPoolItem("Card A", "3")],
        expectedId: "1",
      },
      {
        pool: [poolItem("Card A", "1", 0), poolItem("Card A", "2"), heldPoolItem("Card A", "3")],
        expectedId: "2",
      },
    ];
    for (const { pool, expectedId } of cases) {
      const plan = planOfferSelection([["Card A"], ["Card B"]], [pool, [poolItem("Card B", "4")]], "RANDOM", () => 0);
      assert.equal(plan.failLater, false);
      assert.deepEqual(plan.shortfalls, []);
      assert.equal(plan.moves[0]!.length, 1);
      assert.equal(plan.moves[0]![0]!.id, expectedId);
    }
  });

  it("selects the tradable copy from nested-description pool items", () => {
    // Reported 72850-Troll repro through the live trade-page shape: the pool
    // carries name/verdict on `description`, with two temporally blocked
    // copies and one tradable copy.
    const plan = planOfferSelection(
      [["Card A"], ["Card B"]],
      [
        [
          livePoolItem("Card A", "11", true),
          livePoolItem("Card A", "12", 0),
          livePoolItem("Card A", "13", true, "Tradable After 26/09/2099, 09:00:00"),
        ],
        [livePoolItem("Card B", "14", true)],
      ],
      "SORT",
    );
    assert.equal(plan.failLater, false);
    assert.deepEqual(plan.shortfalls, []);
    assert.equal(plan.moves[0]!.length, 1);
    assert.equal(plan.moves[0]![0]!.id, "11");
    assert.equal(plan.moves[1]!.length, 1);
    assert.equal(plan.moves[1]![0]!.id, "14");
  });

  it("shortfalls nested-description pools as unselectable, not absent", () => {
    // Every copy present but held: the reason must stay `unselectable` with
    // per-copy diagnostics resolved from the nested descriptions.
    const plan = planOfferSelection(
      [["Card A"], []],
      [[livePoolItem("Card A", "11", 0), livePoolItem("Card A", "12", true, "Tradable After 26/09/2099, 09:00:00")]],
      "SORT",
    );
    assert.equal(plan.failLater, true);
    assert.equal(plan.shortfalls.length, 1);
    assert.equal(plan.shortfalls[0]!.reason, "unselectable");
    assert.equal(plan.shortfalls[0]!.detail?.poolCopies, 2);
  });
  it("selects the tradable copy when held copies share the same name (RANDOM)", () => {
    const plan = planOfferSelection(
      [["Card A"], ["Card B"]],
      [[poolItem("Card A", "1", 0), heldPoolItem("Card A", "2"), poolItem("Card A", "3")], [poolItem("Card B", "4")]],
      "RANDOM",
      () => 0,
    );
    assert.equal(plan.failLater, false);
    assert.deepEqual(plan.shortfalls, []);
    assert.equal(plan.moves[0]!.length, 1);
    assert.equal(plan.moves[0]![0]!.id, "3");
  });

  it("attaches per-copy diagnostics to unselectable shortfalls", () => {
    const plan = planOfferSelection(
      [["Card A"], ["Card B"]],
      [[poolItem("Card A", "1", 0), heldPoolItem("Card A", "2")], [poolItem("Card B", "3")]],
      "SORT",
    );
    assert.equal(plan.failLater, true);
    assert.equal(plan.shortfalls.length, 1);
    const shortfall = plan.shortfalls[0]!;
    assert.equal(shortfall.reason, "unselectable");
    assert.equal(shortfall.detail?.poolCopies, 2);
    assert.deepEqual(shortfall.detail?.flagValues, [0, true]);
    assert.equal(shortfall.detail?.holdDates.length, 2);
    assert.equal(shortfall.detail?.holdDates[0], null);
    assert.notEqual(shortfall.detail?.holdDates[1], null);
    // The visible dialog is unchanged by diagnostics.
    assert.match(formatShortfallMessage(plan.shortfalls), /yours: Card A \(present but not tradable right now\)/);
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

describe("empty-offer wiring", () => {
  it("renders a trade-setup dialog with diagnosis and moves nothing on handoff failure", () => {
    const cardNames = [encodeURIComponent("Game A-Card 1")];
    const moveCalls: unknown[] = [];
    const dialogs: Array<[string, string]> = [];
    let cause = "";
    try {
      resolveTradeCards({}, [999], cardNames);
    } catch (e) {
      cause = e instanceof Error ? e.message : String(e);
      const diagnosis = diagnoseTradeHandoff({
        partnerParam: "99999999",
        truncate: getPartner,
        matchParam: "all",
        filter: [999],
        matches: {},
        cardNames,
        cause: e,
      });
      dialogs.push([
        "ASF-STM trade setup failed",
        "Could not prepare the trade offer.\n" + formatTradeSetupMessage(diagnosis),
      ]);
    }
    assert.match(cause, /nothing to add/);
    assert.equal(moveCalls.length, 0);
    assert.equal(dialogs.length, 1);
    assert.match(dialogs[0]![1], /Stage: trade setup/);
    assert.match(dialogs[0]![1], /Cards: 0 to send \/ 0 to receive/);
    assert.match(dialogs[0]![1], /No items were added/);
    assert.match(dialogs[0]![1], /TempAsfStm\.ASF\.STM\.Params/);
    const { yours, theirs } = tradePage();
    assert.equal(yours.querySelectorAll(".has_item").length, 0);
    assert.equal(theirs.querySelectorAll(".has_item").length, 0);
  });

  it("vetoes a non-1:1 trade before moving anything", () => {
    const { yours, theirs } = tradePage();
    const plan = planOfferSelection(
      [["Card A"], ["Card B"]],
      [[poolItem("Card A", "1")], [{ ...poolItem("Card B", "3"), type: "Foil Trading Card" }]],
      "AS_IS",
    );
    assert.equal(plan.failLater, false);
    assert.equal(isOneToOneTrade(plan.cardTypes), false);
    // Mirrors the reordered addCards: the veto fires before MoveItemToTrade.
    const moveCalls: unknown[] = [];
    const dialogs: Array<[string, string]> = [];
    if (plan.failLater || plan.shortfalls.length > 0) {
      dialogs.push(["Items missing", formatShortfallMessage(plan.shortfalls)]);
    } else if (!isOneToOneTrade(plan.cardTypes)) {
      dialogs.push(["Not 1:1 trade", "This is not a valid 1:1 trade. No items were added. Script aborting."]);
    } else {
      applyMoves([yours, theirs], plan.moves);
    }
    assert.equal(moveCalls.length, 0);
    assert.equal(yours.querySelectorAll(".has_item").length, 0);
    assert.equal(theirs.querySelectorAll(".has_item").length, 0);
    assert.equal(dialogs.length, 1);
    assert.match(dialogs[0]![1], /No items were added/);
    assert.doesNotMatch(dialogs[0]![1], /TempAsfStm\.ASF\.STM\.Params/);
  });
});

describe("retryUnselectableCopies", () => {
  function liveTrade(acceptableIds: string[]): {
    deps: LiveRetryDeps;
    attempts: string[];
    slots: [Set<string>, Set<string>];
  } {
    const slots: [Set<string>, Set<string>] = [new Set(), new Set()];
    const attempts: string[] = [];
    const deps: LiveRetryDeps = {
      moveItem: (element: unknown) => {
        const id = (element as { elementId: string }).elementId;
        attempts.push(id);
        if (acceptableIds.includes(id)) {
          slots[0].add(id);
        }
      },
      slotCount: (side: 0 | 1) => slots[side].size,
    };
    return { deps, attempts, slots };
  }

  function unselectable(side: 0 | 1, name: string): UnsuppliedCard {
    return { side, name, reason: "unselectable" };
  }

  it("keeps the first copy the live trade accepts, trying held ones first", () => {
    const pool: OfferPoolItem[][] = [
      [poolItem("Card A", "1", 0), heldPoolItem("Card A", "2"), poolItem("Card A", "3")],
      [poolItem("Card B", "4")],
    ];
    // Only copy "3" is truly tradable; the trade ignores the held copies.
    const { deps, attempts, slots } = liveTrade(["3", "4"]);
    const result = retryUnselectableCopies([unselectable(0, "Card A")], pool, new Set(), deps);
    assert.deepEqual(attempts, ["1", "2", "3"]);
    assert.equal(result.kept.length, 1);
    assert.equal(result.kept[0]!.move.id, "3");
    assert.equal(result.resolved.length, 1);
    assert.deepEqual(result.pending, []);
    assert.equal(slots[0].size, 1);
  });

  it("leaves everything pending when the trade accepts nothing", () => {
    const pool: OfferPoolItem[][] = [[poolItem("Card A", "1", 0)], [poolItem("Card B", "4", 0)]];
    const { deps, slots } = liveTrade([]);
    const shortfalls = [unselectable(0, "Card A"), unselectable(1, "Card B")];
    const result = retryUnselectableCopies(shortfalls, pool, new Set(), deps);
    assert.deepEqual(result.kept, []);
    assert.deepEqual(result.resolved, []);
    assert.deepEqual(result.pending, shortfalls);
    assert.equal(slots[0].size, 0);
    assert.equal(slots[1].size, 0);
  });

  it("skips copies the metadata plan already consumed and passes absent through", () => {
    const pool: OfferPoolItem[][] = [[poolItem("Card A", "9")], []];
    const { deps, attempts } = liveTrade(["9"]);
    const shortfalls: UnsuppliedCard[] = [unselectable(0, "Card A"), { side: 0, name: "Ghost", reason: "absent" }];
    // Copy "9" is already in the trade from phase 1: nothing left to try.
    const result = retryUnselectableCopies(shortfalls, pool, new Set(["9"]), deps);
    assert.deepEqual(attempts, []);
    assert.deepEqual(result.kept, []);
    assert.deepEqual(result.pending, shortfalls);
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
