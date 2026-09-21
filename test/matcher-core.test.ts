// Unit tests for the pure matching core (src/lib/matcher-core.ts).
//
// Run with exactly one command from the repo root:
//
//   pnpm test
//
// Fixtures mirror real usage: `number` is the original Steam slot index and
// cards are sorted by count descending (which permutes `number`). Golden
// outputs below were derived from the extracted implementation, so a refactor
// that changes matching behavior is caught.

import { describe, it } from "vitest";
import assert from "node:assert/strict";

import {
  buildMatchStore,
  calcBadgeState,
  computeMatches,
  resolveCardIds,
  type MatchBadge,
  type MatchCard,
  type MatchDeps,
  type MatchItem,
} from "../src/lib/matcher-core";

/** Badge with counts per Steam slot; cards sorted by count like the scanner. */
function badge(appId: number, counts: number[]): MatchBadge {
  const cards: MatchCard[] = counts.map((count, index) => ({
    item: `card-${index}`,
    hash: `${appId}-hash-${index}`,
    count,
    iconUrl: `icon-${index}`,
    number: index,
  }));
  cards.sort((a, b) => b.count - a.count);
  const total = counts.reduce((sum, c) => sum + c, 0);
  return {
    appId,
    title: `Game ${appId}`,
    maxCards: counts.length,
    maxSets: Math.floor(total / counts.length),
    lastSet: Math.ceil(total / counts.length),
    cards,
  };
}

function deps(overrides: Partial<MatchDeps> = {}): MatchDeps {
  return {
    debugPrint: () => {},
    isMatchEverything: () => false,
    ...overrides,
  };
}

const cardCount = (items: MatchItem[]): number =>
  items.reduce((sum, item) => sum + item.cards.reduce((s, card) => s + card.count, 0), 0);

/** Flattens a side into `hash xN` strings, sorted for stable comparison. */
const sideShape = (items: MatchItem[]): string[] =>
  items.flatMap((item) => item.cards.map((card) => `${card.hash}x${card.count}`)).sort();

describe("calcBadgeState", () => {
  it("returns 2 for an even badge with nothing to do", () => {
    assert.equal(calcBadgeState(badge(1, [2, 2, 2, 2])), 2);
    assert.equal(calcBadgeState(badge(1, [1, 1, 1, 1])), 2);
  });

  it("returns 1 when max sets exist but extras can still be distributed", () => {
    // total 6 / 4 slots -> maxSets 1, lastSet 2; max slot 3 != maxSets
    assert.equal(calcBadgeState(badge(1, [1, 2, 2, 4])), 0);
    // total 6 / 4 slots -> maxSets 1, lastSet 2; top slot 3 != 1 and min 1 == 1
    assert.equal(calcBadgeState(badge(1, [3, 1, 1, 1])), 1);
  });

  it("returns 0 when fewer than max sets exist", () => {
    // total 9 / 4 slots -> maxSets 2; sorted top slot 4 != 2
    assert.equal(calcBadgeState(badge(1, [1, 2, 2, 4])), 0);
  });
});

describe("computeMatches", () => {
  it("produces no trade for an even badge", () => {
    const result = computeMatches([badge(440, [1, 1, 1, 1])], [badge(440, [2, 1, 1, 1])], 0, deps());
    assert.deepEqual(result, { itemsToSend: [], itemsToReceive: [] });
  });

  it("proposes an evening trade when a fair swap helps both sides", () => {
    // We hold two spare slot-3 copies; the bot needs one and holds a spare slot-2.
    const result = computeMatches([badge(100, [0, 0, 0, 2])], [badge(100, [0, 0, 1, 0])], 0, deps());
    assert.deepEqual(sideShape(result.itemsToSend), ["100-hash-3x1"]);
    assert.deepEqual(sideShape(result.itemsToReceive), ["100-hash-2x1"]);
  });

  it("rejects an unfair-to-bot swap that an ANY bot accepts", () => {
    const mine = [badge(100, [0, 0, 0, 2])];
    const theirs = [badge(100, [0, 0, 1, 1])];

    const fair = computeMatches(mine, theirs, 0, deps({ isMatchEverything: () => false }));
    const any = computeMatches(mine, theirs, 0, deps({ isMatchEverything: () => true }));

    assert.equal(cardCount(fair.itemsToSend), 0, "fair bot declines the unbalanced swap");
    assert.equal(cardCount(fair.itemsToReceive), 0);
    assert.equal(cardCount(any.itemsToSend), 1, "ANY bot accepts the same swap");
    assert.equal(cardCount(any.itemsToReceive), 1);
  });

  it("keeps offered and requested counts balanced per game", () => {
    const mine = [badge(440, [4, 1, 1, 1]), badge(570, [0, 3, 2, 1])];
    const theirs = [badge(440, [1, 1, 1, 4]), badge(570, [2, 0, 1, 1])];
    const result = computeMatches(mine, theirs, 0, deps({ isMatchEverything: () => true }));

    assert.ok(cardCount(result.itemsToSend) > 0, "fixture must produce a match");
    for (const appId of [440, 570]) {
      const sent = result.itemsToSend.filter((item) => item.appId === appId);
      const received = result.itemsToReceive.filter((item) => item.appId === appId);
      assert.equal(cardCount(sent), cardCount(received), `appId ${appId} must balance`);
    }
  });

  it("does not mutate the input badges", () => {
    const mine = [badge(440, [4, 1, 1, 1])];
    const theirs = [badge(440, [1, 1, 1, 4])];
    const mineBefore = JSON.stringify(mine);
    const theirsBefore = JSON.stringify(theirs);
    computeMatches(mine, theirs, 0, deps({ isMatchEverything: () => true }));
    assert.equal(JSON.stringify(mine), mineBefore);
    assert.equal(JSON.stringify(theirs), theirsBefore);
  });

  it("is deterministic across repeated runs", () => {
    const build = (): MatchBadge[] => [badge(440, [4, 1, 1, 1]), badge(570, [0, 3, 2, 1])];
    const first = computeMatches(build(), build(), 0, deps({ isMatchEverything: () => true }));
    const second = computeMatches(build(), build(), 0, deps({ isMatchEverything: () => true }));
    assert.deepEqual(sideShape(first.itemsToSend), sideShape(second.itemsToSend));
    assert.deepEqual(sideShape(first.itemsToReceive), sideShape(second.itemsToReceive));
  });
});

describe("resolveCardIds", () => {
  it("expands each card by its count into card-table indices", () => {
    const ids = resolveCardIds(
      [{ appId: 1, title: "t", cards: [{ item: "x", count: 2, iconUrl: "", hash: "b" }] }],
      ["a", "b", "c"],
    );
    assert.deepEqual(ids, [1, 1]);
  });

  it("keeps -1 for hashes missing from the table", () => {
    const ids = resolveCardIds(
      [{ appId: 1, title: "t", cards: [{ item: "x", count: 1, iconUrl: "", hash: "zz" }] }],
      [],
    );
    assert.deepEqual(ids, [-1]);
  });
});

describe("buildMatchStore", () => {
  const send = [{ appId: 440, title: "Game 440", cards: [{ item: "a", count: 2, iconUrl: "", hash: "ha" }] }];
  const receive = [{ appId: 440, title: "Game 440", cards: [{ item: "b", count: 2, iconUrl: "", hash: "hb" }] }];

  it("stores balanced send/receive id lists per game", () => {
    const store = buildMatchStore(send, receive, ["ha", "hb"]);
    assert.deepEqual(store[440], { send: [0, 0], receive: [1, 1] });
  });

  it("throws when the receive side has no matching game entry", () => {
    const other = [{ appId: 570, title: "Game 570", cards: [{ item: "c", count: 1, iconUrl: "", hash: "hc" }] }];
    assert.throws(() => buildMatchStore(send, other, ["ha", "hb", "hc"]), /appIDs don't match/);
  });

  it("throws when the card counts differ between sides", () => {
    const lopsided = [{ appId: 440, title: "Game 440", cards: [{ item: "b", count: 1, iconUrl: "", hash: "hb" }] }];
    assert.throws(() => buildMatchStore(send, lopsided, ["ha", "hb"]), /card count don't match/);
  });
});
