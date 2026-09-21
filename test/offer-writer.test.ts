// Unit tests for the trade-offer selection planner (src/lib/offer-writer.ts).
// Slice 2.5 of modularize-userscript-services: plans must replay the inline
// `addCards` behavior exactly (order, tradable skip, aborts, type parity).
//
// Run with exactly one command from the repo root:
//
//   pnpm test

import { describe, it } from "vitest";
import assert from "node:assert/strict";

import { isOneToOneTrade, planOfferSelection, sortOfferCopiesDesc, type OfferPoolItem } from "../src/lib/offer-writer";

function poolItem(name: string, id: string, type = "Trading Card"): OfferPoolItem {
  return {
    classid: "c",
    instanceid: "i",
    tradable: true,
    market_hash_name: name,
    type,
    id,
    element: { elementId: id },
  };
}

describe("planOfferSelection", () => {
  it("selects one tradable copy per requested name on both sides", () => {
    const plan = planOfferSelection(
      [["Card A"], ["Card B"]],
      [[poolItem("Card A", "11"), poolItem("Card A", "9")], [poolItem("Card B", "7")]],
      "AS_IS",
    );
    assert.equal(plan.failLater, false);
    assert.deepEqual(
      plan.moves[0].map((m) => m.id),
      ["11"],
    );
    assert.deepEqual(
      plan.moves[1].map((m) => m.id),
      ["7"],
    );
    assert.deepEqual(plan.cardTypes, [["Trading Card"], ["Trading Card"]]);
  });

  it("picks the highest id first under SORT order", () => {
    const plan = planOfferSelection(
      [["Card A", "Card A"], []],
      [[poolItem("Card A", "9"), poolItem("Card A", "11")], []],
      "SORT",
    );
    assert.deepEqual(
      plan.moves[0].map((m) => m.id),
      ["11", "9"],
    );
  });

  it("uses the injected random index under RANDOM order", () => {
    const plan = planOfferSelection(
      [["Card A"], []],
      [[poolItem("Card A", "9"), poolItem("Card A", "11")], []],
      "RANDOM",
      () => 1,
    );
    assert.deepEqual(
      plan.moves[0].map((m) => m.id),
      ["11"],
    );
  });

  it("never reuses the same copy twice", () => {
    const plan = planOfferSelection([["Card A", "Card A"], []], [[poolItem("Card A", "9")], []], "AS_IS");
    assert.equal(plan.failLater, true);
    assert.deepEqual(
      plan.moves[0].map((m) => m.id),
      ["9"],
    );
  });

  it("flags missing names without selecting", () => {
    const plan = planOfferSelection([["Ghost"], []], [[poolItem("Card A", "9")], []], "AS_IS");
    assert.equal(plan.failLater, true);
    assert.deepEqual(plan.moves[0], []);
  });

  it("skips trade-held copies and flags when only held copies exist", () => {
    const held = { ...poolItem("Card A", "9"), tradable: false as const };
    const plan = planOfferSelection([["Card A"], []], [[held], []], "AS_IS");
    assert.equal(plan.failLater, true);
    assert.deepEqual(plan.moves[0], []);
  });

  it("ignores pool items nobody requested", () => {
    const plan = planOfferSelection([["Card A"], []], [[poolItem("Card A", "9"), poolItem("Other", "3")], []], "AS_IS");
    assert.equal(plan.failLater, false);
    assert.deepEqual(
      plan.moves[0].map((m) => m.id),
      ["9"],
    );
  });
});

describe("sortOfferCopiesDesc", () => {
  it("orders copies by numeric id descending", () => {
    const copies = [{ id: "9" }, { id: "11" }, { id: "3" }];
    sortOfferCopiesDesc(copies);
    assert.deepEqual(
      copies.map((c) => c.id),
      ["11", "9", "3"],
    );
  });
});

describe("isOneToOneTrade", () => {
  it("accepts matching type multisets", () => {
    assert.equal(
      isOneToOneTrade([
        ["A", "B"],
        ["B", "A"],
      ]),
      true,
    );
  });

  it("rejects unbalanced sides", () => {
    assert.equal(isOneToOneTrade([["A"], ["A", "B"]]), false);
  });

  it("rejects unknown partner types", () => {
    assert.equal(isOneToOneTrade([["A"], ["Z"]]), false);
  });

  it("accepts two empty sides", () => {
    assert.equal(isOneToOneTrade([[], []]), true);
  });
});
