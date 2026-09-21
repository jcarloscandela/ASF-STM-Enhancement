// Unit tests for the Steam payload schemas (src/lib/steam-schema.ts).
//
// Run with exactly one command from the repo root:
//
//   pnpm test
//
// Plain fixtures copied from real Steam shapes. `describe`/`it` come from
// vitest, assertions from node:assert/strict.

import { describe, it } from "vitest";
import assert from "node:assert/strict";

import {
  parseBadgeCard,
  parseBotEntry,
  parseInventoryAsset,
  parseInventoryDescription,
  parseInventoryPayload,
} from "../src/lib/steam-schema";
import { isTradableDescription } from "../src/lib/tradable";

/** A well-formed card description as the inventory endpoint returns it. */
function cardDescription(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    classid: "123456",
    instanceid: "0",
    tradable: true,
    market_fee_app: 440,
    market_hash_name: "440-Refined Metal",
    market_tradable_restriction: 7,
    type: "Steam Trading Card",
    tags: [{ category: "item_class", internal_name: "item_class_2" }],
    descriptions: [{ value: "Tradable", color: "00a000" }],
    ...overrides,
  };
}

describe("parseInventoryDescription", () => {
  it("accepts a well-formed card description and preserves read fields", () => {
    const parsed = parseInventoryDescription(cardDescription());
    assert.ok(parsed);
    assert.equal(parsed.classid, "123456");
    assert.equal(parsed.instanceid, "0");
    assert.equal(parsed.market_fee_app, 440);
    assert.equal(parsed.market_hash_name, "440-Refined Metal");
    assert.equal(parsed.tags?.[0]?.internal_name, "item_class_2");
  });

  it("skips entries missing classid or instanceid", () => {
    assert.equal(parseInventoryDescription({ instanceid: "0" }), undefined);
    assert.equal(parseInventoryDescription({ classid: "1" }), undefined);
    assert.equal(parseInventoryDescription(null), undefined);
    assert.equal(parseInventoryDescription("not an object"), undefined);
  });

  it("coerces numeric ids to strings so counting keys stay stable", () => {
    const parsed = parseInventoryDescription(cardDescription({ classid: 987654, instanceid: 3 }));
    assert.ok(parsed);
    assert.equal(parsed.classid, "987654");
    assert.equal(parsed.instanceid, "3");
  });

  it("ignores unknown Steam fields without dropping the entry", () => {
    const parsed = parseInventoryDescription(
      cardDescription({ brand_new_field: { nested: true }, another: [1, 2, 3] }),
    );
    assert.ok(parsed);
    assert.equal(parsed.classid, "123456");
  });

  it("keeps every tradable flag variant intact for the tradability helpers", () => {
    for (const [flag, expected] of [
      [false, false],
      [0, false],
      ["0", false],
      [true, true],
      [1, true],
      ["1", true],
      [undefined, true],
    ] as const) {
      const parsed = parseInventoryDescription(cardDescription({ tradable: flag }));
      assert.ok(parsed, `flag=${String(flag)} should validate`);
      assert.equal(isTradableDescription(parsed), expected, `flag=${String(flag)}`);
    }
  });

  it("passes future-dated trade holds through validation untouched", () => {
    const parsed = parseInventoryDescription(
      cardDescription({
        descriptions: [{ value: 'Tradable After <span class="date">26 Sep, 2026</span>' }],
      }),
    );
    assert.ok(parsed);
    // The hold text survives parsing; tradable.ts decides the tradability.
    assert.match(parsed.descriptions?.[0]?.value ?? "", /Tradable After/);
    assert.equal(isTradableDescription(parsed), true);
  });
});

describe("parseInventoryAsset", () => {
  it("accepts a well-formed asset and coerces ids", () => {
    const parsed = parseInventoryAsset({ classid: 42, instanceid: "0", amount: "1" });
    assert.ok(parsed);
    assert.equal(parsed.classid, "42");
    assert.equal(parsed.instanceid, "0");
  });

  it("skips unusable assets", () => {
    assert.equal(parseInventoryAsset({ classid: "1" }), undefined);
    assert.equal(parseInventoryAsset(undefined), undefined);
  });
});

describe("parseInventoryPayload", () => {
  it("keeps valid entries and drops malformed ones without aborting", () => {
    const payload = parseInventoryPayload({
      descriptions: [cardDescription(), { classid: "9" }, null, cardDescription({ classid: "2" })],
      assets: [{ classid: "1", instanceid: "0" }, { instanceid: "0" }],
    });
    assert.equal(payload.descriptions.length, 2);
    assert.equal(payload.assets.length, 1);
  });

  it("returns empty collections for a non-object payload", () => {
    for (const value of [null, undefined, "nope", 42]) {
      const payload = parseInventoryPayload(value);
      assert.deepEqual(payload, { descriptions: [], assets: [] });
    }
  });

  it("ignores non-array description/asset fields", () => {
    const payload = parseInventoryPayload({ descriptions: "nope", assets: {} });
    assert.deepEqual(payload, { descriptions: [], assets: [] });
  });
});

describe("parseBadgeCard", () => {
  it("accepts a well-formed badge card entry", () => {
    const parsed = parseBadgeCard({
      title: "Half-Life 2",
      markethash: "HL2-Card",
      owned: 3,
      imgurl: "https://cdn.example/card.png",
    });
    assert.ok(parsed);
    assert.equal(parsed.owned, 3);
    assert.equal(parsed.title, "Half-Life 2");
  });

  it("coerces a string owned count and defaults a missing imgurl", () => {
    const parsed = parseBadgeCard({ title: "X", markethash: "H", owned: "4" });
    assert.ok(parsed);
    assert.equal(parsed.owned, 4);
    assert.equal(parsed.imgurl, "");
  });

  it("skips entries with a missing title or market hash", () => {
    assert.equal(parseBadgeCard({ markethash: "H", owned: 1 }), undefined);
    assert.equal(parseBadgeCard({ title: "T", owned: 1 }), undefined);
    assert.equal(parseBadgeCard({ title: "T", markethash: "", owned: 1 }), undefined);
  });

  it("skips an unusable owned count", () => {
    assert.equal(parseBadgeCard({ title: "T", markethash: "H", owned: "many" }), undefined);
  });
});

describe("parseBotEntry", () => {
  it("accepts string SteamIDs unchanged and documents the numeric precision limit", () => {
    // SteamIDs exceed Number.MAX_SAFE_INTEGER, so they must arrive as strings
    // to stay exact; a numeric fixture cannot round-trip.
    const exact = parseBotEntry({ SteamID: "76561198000000001", Nickname: "Bot" });
    assert.ok(exact);
    assert.equal(exact.SteamID, "76561198000000001");

    const beyondSafe = Number("76561198000000001");
    assert.ok(beyondSafe > Number.MAX_SAFE_INTEGER);
    assert.notEqual(String(beyondSafe), "76561198000000001");
  });

  it("skips entries with an unusable SteamID", () => {
    assert.equal(parseBotEntry({ SteamID: "not-a-steamid" }), undefined);
    assert.equal(parseBotEntry({ SteamID: "" }), undefined);
    assert.equal(parseBotEntry({}), undefined);
    assert.equal(parseBotEntry(null), undefined);
  });

  it("keeps optional fields optional so counts can fall back safely", () => {
    const parsed = parseBotEntry({ SteamID: "76561198000000001" });
    assert.ok(parsed);
    assert.equal(parsed.TotalInventoryCount, undefined);
    assert.equal(parsed.TradeToken, undefined);
  });

  it("normalizes a numeric SteamID to a string", () => {
    const parsed = parseBotEntry({
      SteamID: 12345,
      MatchEverything: true,
      MatchableTypes: [5],
      TotalInventoryCount: 120,
    });
    assert.ok(parsed);
    assert.equal(parsed.SteamID, "12345");
    assert.equal(parsed.MatchEverything, true);
    assert.deepEqual(parsed.MatchableTypes, [5]);
  });
});
