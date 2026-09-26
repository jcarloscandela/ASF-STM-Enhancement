// Unit tests for the bot-list ordering table (src/lib/bot-sort.ts).
//
// Run with exactly one command from the repo root:
//
//   pnpm test

import { describe, it } from "vitest";
import assert from "node:assert/strict";

import { compareBots } from "../src/lib/bot-sort";
import type { BotEntry } from "../src/lib/models";

function bot(overrides: Partial<BotEntry> = {}): BotEntry {
  return {
    SteamID: "1",
    Nickname: "bot",
    AvatarHash: null,
    MatchEverything: false,
    TotalInventoryCount: 100,
    MatchableTypes: [5],
    ...overrides,
  };
}

describe("compareBots", () => {
  it("orders match-everything bots first or last", () => {
    const any = bot({ MatchEverything: true });
    const fair = bot({ MatchEverything: false });
    assert.ok(compareBots(any, fair, ["MatchEverythingFirst"]) < 0);
    assert.ok(compareBots(any, fair, ["MatchEverythingLast"]) > 0);
    assert.equal(compareBots(any, bot({ MatchEverything: true }), ["MatchEverythingFirst"]), 0);
  });

  it("orders numeric counts in both directions", () => {
    const big = bot({ TotalInventoryCount: 200, TotalGamesCount: 10, TotalItemsCount: 30 });
    const small = bot({ TotalInventoryCount: 100, TotalGamesCount: 5, TotalItemsCount: 20 });
    assert.ok(compareBots(big, small, ["TotalInventoryCountDesc"]) < 0);
    assert.ok(compareBots(big, small, ["TotalInventoryCountAsc"]) > 0);
    assert.ok(compareBots(big, small, ["TotalGamesCountDesc"]) < 0);
    assert.ok(compareBots(big, small, ["TotalGamesCountAsc"]) > 0);
    assert.ok(compareBots(big, small, ["TotalItemsCountDesc"]) < 0);
    assert.ok(compareBots(big, small, ["TotalItemsCountAsc"]) > 0);
  });

  it("falls through chained keys on ties", () => {
    const a = bot({ MatchEverything: true, TotalInventoryCount: 100 });
    const b = bot({ MatchEverything: true, TotalInventoryCount: 200 });
    assert.ok(compareBots(a, b, ["MatchEverythingFirst", "TotalInventoryCountDesc"]) > 0);
    assert.ok(compareBots(b, a, ["MatchEverythingFirst", "TotalInventoryCountDesc"]) < 0);
  });

  it("ignores unknown keys and empty chains", () => {
    const a = bot({ TotalInventoryCount: 100 });
    const b = bot({ TotalInventoryCount: 200 });
    assert.equal(compareBots(a, b, []), 0);
    assert.equal(compareBots(a, b, ["NoSuchKey"]), 0);
    assert.ok(compareBots(a, b, ["NoSuchKey", "TotalInventoryCountAsc"]) < 0);
  });

  it("sorts arrays deterministically through chained keys", () => {
    const bots = [
      bot({ SteamID: "1", MatchEverything: false, TotalInventoryCount: 300 }),
      bot({ SteamID: "2", MatchEverything: true, TotalInventoryCount: 100 }),
      bot({ SteamID: "3", MatchEverything: true, TotalInventoryCount: 200 }),
    ];
    const sorted = [...bots].sort((x, y) => compareBots(x, y, ["MatchEverythingFirst", "TotalInventoryCountDesc"]));
    assert.deepEqual(
      sorted.map((entry) => entry.SteamID),
      ["3", "2", "1"],
    );
  });
});
