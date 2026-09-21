// Unit tests for the tradability helpers (src/lib/tradable.ts).
//
// Run with exactly one command from the repo root:
//
//   pnpm test
//
// Uses plain Steam-inventory-shaped fixtures. `describe`/`it` come from
// vitest, assertions from node:assert/strict.

import { describe, it } from "vitest";
import assert from "node:assert/strict";

import {
  buildInventoryCardCounts,
  buildScanEligibility,
  getTradableAfterTime,
  hasFutureTradeHold,
  isCurrentlyTradableDescription,
  isTradableDescription,
  isTradeOfferItemTradable,
  type InventoryCardData,
  type InventoryData,
  type SteamInventoryAsset,
  type SteamInventoryDescription,
} from "../src/lib/tradable";

function cardDescription(overrides: Partial<SteamInventoryDescription> = {}): SteamInventoryDescription {
  return {
    classid: "100",
    instanceid: "200",
    market_fee_app: 753,
    market_hash_name: "Game-Card A",
    tradable: 1,
    tags: [
      { category: "item_class", internal_name: "item_class_2" },
      { category: "cardborder", internal_name: "cardborder_0" },
    ],
    ...overrides,
  };
}

function asset(classid = "100", instanceid = "200"): SteamInventoryAsset {
  return { classid, instanceid };
}

describe("isTradableDescription", () => {
  it("treats missing/positive flags as tradable", () => {
    for (const desc of [
      cardDescription({ tradable: 1 }),
      cardDescription({ tradable: "1" }),
      cardDescription({ tradable: true }),
    ]) {
      assert.equal(isTradableDescription(desc), true);
    }
    const noFlag = cardDescription();
    delete noFlag.tradable;
    assert.equal(isTradableDescription(noFlag), true);
  });

  it('treats false, 0 and "0" as trade-held', () => {
    for (const flag of [false, 0, "0"]) {
      assert.equal(isTradableDescription(cardDescription({ tradable: flag })), false, `flag=${JSON.stringify(flag)}`);
    }
  });

  it("ignores market_tradable_restriction on tradable items", () => {
    const desc = cardDescription({ tradable: 1, market_tradable_restriction: 7 });
    assert.equal(isTradableDescription(desc), true);
  });
});

describe('time-gated trade holds ("Tradable After")', () => {
  // Fixed clock: 21 Sep 2026, noon local. All dates below are fixed relative
  // to it so the tests stay deterministic regardless of the real run date.
  const NOW = new Date(2026, 8, 21, 12, 0, 0).getTime();

  function heldDescription(
    value: string,
    overrides: Partial<SteamInventoryDescription> = {},
  ): SteamInventoryDescription {
    return cardDescription({
      tradable: 1,
      descriptions: [{ value, color: "" }],
      ...overrides,
    });
  }

  it("treats a future DD/MM/YYYY hold as non-tradable (reported Alyx Vance case)", () => {
    const desc = heldDescription("Tradable After: 26/09/2026, 09:00:00");
    assert.equal(hasFutureTradeHold(desc, NOW), true);
    assert.equal(isCurrentlyTradableDescription(desc, NOW), false);
  });

  it("treats a past hold as tradable again", () => {
    const desc = heldDescription("Tradable After: 01/09/2026, 09:00:00");
    assert.equal(hasFutureTradeHold(desc, NOW), false);
    assert.equal(isCurrentlyTradableDescription(desc, NOW), true);
  });

  it("parses month-name and ISO dates", () => {
    assert.equal(hasFutureTradeHold(heldDescription("Tradable After Sep 26, 2026"), NOW), true);
    assert.equal(hasFutureTradeHold(heldDescription("Tradable After 26 Sep 2026"), NOW), true);
    assert.equal(hasFutureTradeHold(heldDescription("Tradable After 2026-09-26"), NOW), true);
    assert.equal(hasFutureTradeHold(heldDescription("Tradable After Jan 1, 2020"), NOW), false);
  });

  it("reads the hold from owner_descriptions too", () => {
    const desc = cardDescription({
      tradable: 1,
      owner_descriptions: [{ value: "Tradable After: 26/09/2026, 09:00:00", color: "" }],
    });
    assert.equal(isCurrentlyTradableDescription(desc, NOW), false);
  });

  it("falls back to the tradable flag when the hold date is missing or unparseable", () => {
    const noDate = heldDescription("Tradable After soon");
    assert.equal(getTradableAfterTime(noDate), null);
    assert.equal(isCurrentlyTradableDescription(noDate, NOW), true);

    const policyText = heldDescription("Items are tradable after purchase on the market");
    assert.equal(isCurrentlyTradableDescription(policyText, NOW), true);

    const noLines = cardDescription({ tradable: 1 });
    assert.equal(isCurrentlyTradableDescription(noLines, NOW), true);
  });

  it("keeps the tradable flag authoritative for hard holds", () => {
    const heldFlag = heldDescription("Tradable After: 01/09/2026, 09:00:00", { tradable: 0 });
    assert.equal(isCurrentlyTradableDescription(heldFlag, NOW), false);

    const heldFlagPast = cardDescription({ tradable: false });
    assert.equal(isCurrentlyTradableDescription(heldFlagPast, NOW), false);
  });

  it("still ignores market_tradable_restriction when a dated hold is present", () => {
    const desc = heldDescription("Tradable After: 26/09/2026, 09:00:00", {
      market_tradable_restriction: 7,
    });
    assert.equal(isCurrentlyTradableDescription(desc, NOW), false);
    const noHold = cardDescription({ tradable: 1, market_tradable_restriction: 7 });
    assert.equal(isCurrentlyTradableDescription(noHold, NOW), true);
  });

  it("excludes future-dated copies from tradable counts but keeps them owned", () => {
    const future = cardDescription({
      classid: "101",
      instanceid: "201",
      tradable: 1,
      descriptions: [{ value: "Tradable After: 26/09/2099, 09:00:00", color: "" }],
    });
    const past = cardDescription({
      classid: "102",
      instanceid: "202",
      tradable: 1,
      market_hash_name: "Game-Card A",
      descriptions: [{ value: "Tradable After: 01/01/2020, 09:00:00", color: "" }],
    });
    const inventory: InventoryData = {
      descriptions: [cardDescription(), future, past],
      assets: [asset(), asset("101", "201"), asset("102", "202")],
    };
    assert.deepEqual(buildInventoryCardCounts(inventory), {
      753: {
        "Game-Card A": { owned: 3, tradable: 2 },
      },
    });
  });
});

describe("isTradeOfferItemTradable", () => {
  const NOW = new Date(2026, 8, 21, 12, 0, 0).getTime();

  function offerItem(overrides: Partial<SteamInventoryDescription> = {}): SteamInventoryDescription {
    return {
      classid: "100",
      instanceid: "200",
      market_hash_name: "Game-Card A",
      tradable: 1,
      type: "Trading Card",
      ...overrides,
    };
  }

  it("accepts plain tradable copies", () => {
    assert.equal(isTradeOfferItemTradable(offerItem(), NOW), true);
  });

  it("rejects flag-held copies", () => {
    assert.equal(isTradeOfferItemTradable(offerItem({ tradable: 0 }), NOW), false);
  });

  it("rejects future-dated holds", () => {
    const item = offerItem({
      descriptions: [{ value: "Tradable After: 26/09/2026, 09:00:00", color: "" }],
    });
    assert.equal(isTradeOfferItemTradable(item, NOW), false);
  });

  it("accepts past-dated holds and unknown shapes (fail open)", () => {
    const past = offerItem({
      descriptions: [{ value: "Tradable After: 01/01/2020, 09:00:00", color: "" }],
    });
    assert.equal(isTradeOfferItemTradable(past, NOW), true);
    assert.equal(isTradeOfferItemTradable(null, NOW), true);
    assert.equal(isTradeOfferItemTradable({} as SteamInventoryDescription, NOW), true);
  });
});

describe("buildInventoryCardCounts", () => {
  it("counts all copies as owned and only currently tradable copies as tradable", () => {
    const held = cardDescription({ classid: "101", instanceid: "201", market_hash_name: "Game-Card H", tradable: 0 });
    const inventory: InventoryData = {
      descriptions: [cardDescription(), held],
      assets: [asset(), asset(), asset("101", "201"), asset("101", "201")],
    };
    assert.deepEqual(buildInventoryCardCounts(inventory), {
      753: {
        "Game-Card A": { owned: 2, tradable: 2 },
        "Game-Card H": { owned: 2, tradable: 0 },
      },
    });
  });

  it("keeps games whose cards are all held, with tradable zero", () => {
    const inventory: InventoryData = {
      descriptions: [cardDescription({ tradable: false })],
      assets: [asset()],
    };
    assert.deepEqual(buildInventoryCardCounts(inventory), {
      753: { "Game-Card A": { owned: 1, tradable: 0 } },
    });
  });

  it("excludes foil cards and non-card items", () => {
    const foil = cardDescription({
      classid: "102",
      instanceid: "202",
      tags: [
        { category: "item_class", internal_name: "item_class_2" },
        { category: "cardborder", internal_name: "cardborder_1" },
      ],
    });
    const booster = cardDescription({
      classid: "103",
      instanceid: "203",
      tags: [{ category: "item_class", internal_name: "item_class_3" }],
    });
    const inventory: InventoryData = {
      descriptions: [cardDescription(), foil, booster],
      assets: [asset(), asset("102", "202"), asset("103", "203")],
    };
    assert.deepEqual(buildInventoryCardCounts(inventory), {
      753: { "Game-Card A": { owned: 1, tradable: 1 } },
    });
  });

  it("skips descriptions without market_fee_app or market_hash_name", () => {
    const noApp = cardDescription({ classid: "104", instanceid: "204", market_fee_app: undefined });
    const noHash = cardDescription({ classid: "105", instanceid: "205", market_hash_name: undefined });
    const inventory: InventoryData = {
      descriptions: [cardDescription(), noApp, noHash],
      assets: [asset(), asset("104", "204"), asset("105", "205")],
    };
    assert.deepEqual(buildInventoryCardCounts(inventory), {
      753: { "Game-Card A": { owned: 1, tradable: 1 } },
    });
  });

  it("ignores assets with no matching description", () => {
    const inventory: InventoryData = {
      descriptions: [cardDescription()],
      assets: [asset(), asset("999", "999")],
    };
    assert.deepEqual(buildInventoryCardCounts(inventory), {
      753: { "Game-Card A": { owned: 1, tradable: 1 } },
    });
  });

  it("works without a debugPrint global (release build / Node)", () => {
    assert.equal(typeof globalThis.debugPrint, "undefined");
    const inventory: InventoryData = { descriptions: [cardDescription()], assets: [asset()] };
    assert.deepEqual(buildInventoryCardCounts(inventory), {
      753: { "Game-Card A": { owned: 1, tradable: 1 } },
    });
  });

  it("logs a summary when a debugPrint global exists", () => {
    const messages: string[] = [];
    globalThis.debugPrint = (msg) => messages.push(msg);
    try {
      const inventory: InventoryData = { descriptions: [cardDescription()], assets: [asset()] };
      buildInventoryCardCounts(inventory);
      assert.match(messages.join("\n"), /1 card app\(s\)/);
    } finally {
      globalThis.debugPrint = undefined;
    }
  });
});

describe("buildScanEligibility", () => {
  // [owned, tradable] per market hash; only hashes with at least one owned
  // copy appear in real counting output.
  function cards(entries: Record<string, [number, number]>): Record<string, InventoryCardData> {
    return Object.fromEntries(Object.entries(entries).map(([hash, [owned, tradable]]) => [hash, { owned, tradable }]));
  }
  const db = { 753: { size: 5, name: "Game" } };

  it("flags evenly distributed owned badges as balanced", () => {
    const result = buildScanEligibility({ 753: cards({ A: [2, 2], B: [2, 2], C: [2, 2], D: [2, 2], E: [2, 2] }) }, db);
    assert.equal(result[753]?.unbalanced, false);
    assert.equal(result[753]?.max_size, 5);
  });

  it("flags unevenly distributed owned badges as unbalanced", () => {
    const result = buildScanEligibility({ 753: cards({ A: [3, 3], B: [1, 1], C: [1, 1], D: [1, 1], E: [1, 1] }) }, db);
    assert.equal(result[753]?.unbalanced, true);
  });

  it("flags badges with missing cards as unbalanced when a set exists", () => {
    const result = buildScanEligibility({ 753: cards({ A: [2, 2], B: [2, 2] }) }, db);
    assert.equal(result[753]?.unbalanced, true);
  });

  it("includes a badge whose only tradable copy misses the remaining cards", () => {
    // One tradable duplicate plus missing (possibly held) cards can still
    // complete a set, so the badge must reach matching.
    const result = buildScanEligibility({ 753: cards({ A: [1, 1] }) }, db);
    assert.equal(result[753]?.unbalanced, true);
  });

  it("includes badges whose duplicates are owned-but-held alongside a tradable copy", () => {
    // Reported scenario: five owned copies of Card A of which one is
    // tradable, plus a held copy of Card D - the badge can still be matched
    // (exactly one swap), so it must stay a candidate.
    const result = buildScanEligibility({ 753: cards({ A: [5, 1], D: [1, 0] }) }, db);
    assert.equal(result[753]?.unbalanced, true);
  });

  it("excludes a badge with no tradable copies at all", () => {
    const result = buildScanEligibility({ 753: cards({ A: [3, 0], B: [1, 0], C: [1, 0], D: [1, 0], E: [1, 0] }) }, db);
    assert.equal(result[753]?.unbalanced, false);
  });

  it("skips games absent from the badges database", () => {
    const result = buildScanEligibility({ 12345: cards({ A: [5, 5] }) }, db);
    assert.deepEqual(result, {});
  });
});
