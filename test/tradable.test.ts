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
  buildBadgeFromCardList,
  buildInventoryCardCounts,
  buildScanEligibility,
  getTradableAfterTime,
  hasFutureTradeHold,
  isCurrentlyTradableDescription,
  isTradableDescription,
  isTradeOfferItemTradable,
  type InventoryCardCounts,
  type InventoryCardData,
  type InventoryData,
  type SteamInventoryAsset,
  type SteamInventoryDescription,
} from "../src/lib/tradable";
import {
  BUNDLED_ICON_URL_PREFIX,
  normalizeDataset,
  readBadgeCardCache,
  resolveBadgeEntry,
  writeBadgeCardCacheEntry,
} from "../src/lib/dataset";
import { computeMatches } from "../src/lib/matcher-core";
import type { StorageLike } from "../src/lib/storage";

function fakeStorage(seed: Record<string, string> = {}): StorageLike {
  const map = new Map<string, string>(Object.entries(seed));
  return {
    getItem: (key) => (map.has(key) ? (map.get(key) as string) : null),
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

function cardEntry(owned: number, tradable: number): InventoryCardData {
  return { owned, tradable };
}

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

describe("normalizeDataset", () => {
  it("normalizes the counts-only export", () => {
    const raw = [
      { app_id: "1000010", card_count: "5" },
      { app_id: 1000030, card_count: 8 },
    ];
    assert.deepEqual(normalizeDataset(raw), {
      1000010: { size: 5 },
      1000030: { size: 8 },
    });
  });

  it("normalizes the counts record with string card lists", () => {
    const raw = {
      1000010: { size: 5, name: "Some Game", cards: ["Some Game - Card A", "Some Game - Card B"] },
    };
    assert.deepEqual(normalizeDataset(raw), {
      1000010: {
        size: 5,
        name: "Some Game",
        cards: [{ hash: "Some Game - Card A" }, { hash: "Some Game - Card B" }],
      },
    });
  });

  it("normalizes the badge-cards record with card objects", () => {
    const raw = {
      220: {
        size: 8,
        cards: [
          { hash: "220-Alyx Vance", title: "Alyx Vance", iconUrl: "https://example.test/alyx" },
          { hash: "220-G-Man" },
        ],
      },
    };
    assert.deepEqual(normalizeDataset(raw), {
      220: {
        size: 8,
        cards: [
          { hash: "220-Alyx Vance", title: "Alyx Vance", iconUrl: "https://example.test/alyx" },
          { hash: "220-G-Man" },
        ],
      },
    });
  });

  it("drops unusable cards and keeps size-only entries", () => {
    const raw = {
      221: { size: 6, cards: [{ hash: "" }, { title: "No hash" }, null, 42, { hash: "221-Kept", title: "Kept" }] },
      222: { size: 7, cards: [{ hash: "" }, null] },
    };
    assert.deepEqual(normalizeDataset(raw), {
      221: { size: 6, cards: [{ hash: "221-Kept", title: "Kept" }] },
      222: { size: 7 },
    });
  });

  it("ignores invalid entries and keeps the rest", () => {
    const raw = [
      { app_id: "1000010", card_count: "5" },
      { app_id: "1000011", card_count: "0" },
      { app_id: "1000012", card_count: "nope" },
      { app_id: "1000013" },
      "garbage",
      null,
    ];
    assert.deepEqual(normalizeDataset(raw), { 1000010: { size: 5 } });
  });

  it("returns an empty dataset for corrupt input", () => {
    for (const raw of [null, undefined, "corrupt", 42]) {
      assert.deepEqual(normalizeDataset(raw), {});
    }
  });

  it("decodes the compact encoding identically to the long-key shape", () => {
    const fullIcon = `${BUNDLED_ICON_URL_PREFIX}suffix-bytes`;
    const longhand = {
      220: {
        size: 8,
        cards: [{ hash: "220-Alyx Vance", title: "Alyx Vance", iconUrl: fullIcon }, { hash: "220-G-Man" }],
      },
      1000010: { size: 5 },
    };
    const compact = {
      220: { s: 8, c: [{ h: "220-Alyx Vance", t: "Alyx Vance", u: "suffix-bytes" }, { h: "220-G-Man" }] },
      1000010: { s: 5 },
    };
    assert.deepEqual(normalizeDataset(compact), normalizeDataset(longhand));
  });
});

describe("resolveBadgeEntry", () => {
  it("merges dataset and cache with the dataset winning on conflicts", () => {
    const dataset = normalizeDataset({ 753: { size: 5, name: "Bundled Name" } });
    const cache = {
      753: { size: 9, name: "Cache Name", cards: [{ hash: "753-A" }] },
    };
    assert.deepEqual(resolveBadgeEntry(dataset, cache, 753), {
      size: 5,
      name: "Bundled Name",
      cards: [{ hash: "753-A" }],
    });
  });

  it("fills in what the dataset lacks from the cache", () => {
    const dataset = normalizeDataset({ 753: { size: 5 } });
    const cache = {
      753: { cards: [{ hash: "753-A", title: "Card A" }] },
    };
    assert.deepEqual(resolveBadgeEntry(dataset, cache, 753), {
      size: 5,
      name: undefined,
      cards: [{ hash: "753-A", title: "Card A" }],
    });
  });

  it("passes bundled rich cards through verbatim instead of the cache", () => {
    const rich = normalizeDataset({
      753: { size: 5, cards: [{ hash: "753-A", title: "Card A", iconUrl: "https://example.test/icon-a" }] },
    });
    const counts = normalizeDataset({ 753: { size: 5 } });
    const cache = {
      753: { size: 9, name: "Cache Name", cards: [{ hash: "753-Stale" }] },
    };
    assert.deepEqual(resolveBadgeEntry(rich, cache, 753), {
      size: 5,
      name: "Cache Name",
      cards: [{ hash: "753-A", title: "Card A", iconUrl: "https://example.test/icon-a" }],
    });
    assert.deepEqual(resolveBadgeEntry(counts, cache, 753), {
      size: 5,
      name: "Cache Name",
      cards: [{ hash: "753-Stale" }],
    });
  });
});

describe("badge card cache", () => {
  it("round-trips a learned entry through localStorage", () => {
    const storage = fakeStorage();
    const cache = readBadgeCardCache(storage);
    writeBadgeCardCacheEntry(storage, cache, 753, {
      size: 5,
      cards: [{ hash: "753-A", title: "Card A", iconUrl: "icon-a" }, { hash: "753-B" }],
    });
    const reloaded = readBadgeCardCache(storage);
    assert.deepEqual(reloaded[753]?.cards, [{ hash: "753-A", title: "Card A", iconUrl: "icon-a" }, { hash: "753-B" }]);
    assert.equal(reloaded[753]?.size, 5);
  });

  it("ignores corrupt cache content", () => {
    const storage = fakeStorage({ "TempAsfStm.ASF.STM.BadgeCards.v1": "not json" });
    const cache = readBadgeCardCache(storage);
    assert.deepEqual(cache, {});
    const seed = fakeStorage({ "TempAsfStm.ASF.STM.BadgeCards.v1": JSON.stringify({ 753: { size: "bad" } }) });
    assert.deepEqual(readBadgeCardCache(seed), {});
  });
});

describe("buildBadgeFromCardList", () => {
  const cardCounts: InventoryCardCounts = {
    440: {
      "Game - Card A": cardEntry(5, 1),
      "Game - Card B": cardEntry(0, 0),
      "Game - Card C": cardEntry(0, 0),
      "Game - Card D": cardEntry(1, 0),
      "Game - Card E": cardEntry(0, 0),
    },
  };

  it("derives slots for every card of the set, zero-owned included", () => {
    const cardList = ["Game - Card A", "Game - Card B", "Game - Card C", "Game - Card D", "Game - Card E"].map(
      (hash) => ({ hash }),
    );
    const badge = buildBadgeFromCardList(440, "Game", 5, cardList, cardCounts);
    assert.ok(badge);
    assert.equal(badge.maxCards, 5);
    assert.deepEqual(
      badge.cards.map((card) => ({ hash: card.hash, count: card.count, tradableCount: card.tradableCount })),
      [
        { hash: "Game - Card A", count: 5, tradableCount: 1 },
        { hash: "Game - Card B", count: 0, tradableCount: 0 },
        { hash: "Game - Card C", count: 0, tradableCount: 0 },
        { hash: "Game - Card D", count: 1, tradableCount: 0 },
        { hash: "Game - Card E", count: 0, tradableCount: 0 },
      ],
    );
    assert.deepEqual(
      badge.cards.map((card) => card.item),
      cardList.map((card) => card.hash),
    );
  });

  it("uses cached titles and icons when the card list carries them", () => {
    const cardList = [
      { hash: "Game - Card A", title: "Card A", iconUrl: "icon-a" },
      { hash: "Game - Card B", title: "Card B" },
      { hash: "Game - Card C" },
      { hash: "Game - Card D", title: "Card D" },
      { hash: "Game - Card E", title: "Card E" },
    ];
    const badge = buildBadgeFromCardList(440, "Game", 5, cardList, cardCounts);
    assert.ok(badge);
    assert.deepEqual(
      badge.cards.map((card) => ({ item: card.item, iconUrl: card.iconUrl })),
      [
        { item: "Card A", iconUrl: "icon-a" },
        { item: "Card B", iconUrl: "" },
        { item: "Game - Card C", iconUrl: "" },
        { item: "Card D", iconUrl: "" },
        { item: "Card E", iconUrl: "" },
      ],
    );
  });

  it("derives complete slots from the bundled rich layer with an empty cache", () => {
    // Cache-less first run: the badge-cards record normalizes into full card
    // objects, the rich entry wins over the cache, and the derived badge
    // carries bundled titles and artwork with no detail fetch involved.
    const rich = normalizeDataset({
      220: {
        size: 5,
        cards: [
          { hash: "220-Alyx Vance", title: "Alyx Vance", iconUrl: "https://example.test/alyx" },
          { hash: "220-G-Man", title: "G-Man", iconUrl: "https://example.test/gman" },
          { hash: "220-Gordon Freeman", title: "Gordon Freeman" },
          { hash: "220-Respite", title: "Respite" },
          { hash: "220-Witch Hunt", title: "Witch Hunt" },
        ],
      },
    });
    const resolved = resolveBadgeEntry(rich, {}, 220);
    assert.equal(resolved.size, 5);
    assert.ok(resolved.cards);
    const badge = buildBadgeFromCardList(220, "AppID 220", resolved.size!, resolved.cards!, {
      220: { "220-Alyx Vance": cardEntry(3, 1), "220-G-Man": cardEntry(0, 0) },
    });
    assert.ok(badge);
    assert.deepEqual(
      badge.cards.map((card) => ({ item: card.item, hash: card.hash, iconUrl: card.iconUrl })),
      [
        { item: "Alyx Vance", hash: "220-Alyx Vance", iconUrl: "https://example.test/alyx" },
        { item: "G-Man", hash: "220-G-Man", iconUrl: "https://example.test/gman" },
        { item: "Gordon Freeman", hash: "220-Gordon Freeman", iconUrl: "" },
        { item: "Respite", hash: "220-Respite", iconUrl: "" },
        { item: "Witch Hunt", hash: "220-Witch Hunt", iconUrl: "" },
      ],
    );
  });

  it("returns undefined on a card-list/set-size mismatch", () => {
    const cardList = ["Game - Card A", "Game - Card B", "Game - Card C", "Game - Card D"].map((hash) => ({ hash }));
    assert.equal(buildBadgeFromCardList(753, "Game", 5, cardList, cardCounts), undefined);
  });

  it("returns undefined for set sizes below the five-card minimum", () => {
    const cardList = ["Game - Card A", "Game - Card B"].map((hash) => ({ hash }));
    assert.equal(buildBadgeFromCardList(753, "Game", 2, cardList, cardCounts), undefined);
  });

  it("derives badges the matcher can consume (reported scenario)", () => {
    // Five owned copies of Card A of which one is tradable, one held Card D,
    // missing B/C/E: the derived badge must yield exactly one swap for a
    // missing card and never request the owned Card D.
    const cardList = ["Game - Card A", "Game - Card B", "Game - Card C", "Game - Card D", "Game - Card E"].map(
      (hash) => ({ hash }),
    );
    const badge = buildBadgeFromCardList(440, "Game 440", 5, cardList, cardCounts);
    assert.ok(badge);
    badge.cards.sort((a, b) => b.count - a.count);
    const total = badge.cards.reduce((sum, card) => sum + card.count, 0);
    badge.maxSets = Math.floor(total / badge.maxCards);
    badge.lastSet = Math.ceil(total / badge.maxCards);
    const theirs = buildBadgeFromCardList(
      440,
      "Game 440",
      5,
      ["Game - Card A", "Game - Card B", "Game - Card C", "Game - Card D", "Game - Card E"].map((hash) => ({
        hash,
      })),
      {
        440: {
          "Game - Card A": cardEntry(0, 0),
          "Game - Card B": cardEntry(2, 2),
          "Game - Card C": cardEntry(2, 2),
          "Game - Card D": cardEntry(2, 2),
          "Game - Card E": cardEntry(2, 2),
        },
      },
    );
    assert.ok(theirs);
    const result = computeMatches([badge], [theirs], 0, { debugPrint: () => {}, isMatchEverything: () => true });
    assert.equal(result.itemsToSend.length, 1, "exactly one swap: only one tradable copy");
    const received = result.itemsToReceive.flatMap((item) => item.cards.map((card) => card.hash));
    assert.ok(!received.includes("Game - Card D"), "owned card D must never be requested");
    assert.ok(
      received.every((hash) => ["Game - Card B", "Game - Card C", "Game - Card E"].includes(hash)),
      `swap must request a missing card, got ${received.join(", ")}`,
    );
  });
});
