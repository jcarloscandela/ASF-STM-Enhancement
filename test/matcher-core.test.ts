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
function badge(appId: number, counts: number[], tradable?: number[]): MatchBadge {
  const cards: MatchCard[] = counts.map((count, index) => {
    const card: MatchCard = {
      item: `card-${index}`,
      hash: `${appId}-hash-${index}`,
      count,
      iconUrl: `icon-${index}`,
      number: index,
    };
    if (tradable !== undefined) {
      card.tradableCount = tradable[index]!;
    }
    return card;
  });
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
    // We hold two spare slot-3 copies; the bot needs one and holds two slot-2
    // copies (retaining one after the swap - partners never part with their
    // last copy).
    const result = computeMatches([badge(100, [0, 0, 0, 2])], [badge(100, [0, 0, 2, 0])], 0, deps());
    assert.deepEqual(sideShape(result.itemsToSend), ["100-hash-3x1"]);
    assert.deepEqual(sideShape(result.itemsToReceive), ["100-hash-2x1"]);
  });

  it("rejects an unfair-to-bot swap that an ANY bot accepts", () => {
    // Partner holds two copies of both slots so the retain-one rule lets the
    // ANY-mode swap through while the fair-bot fairness check still declines it.
    const mine = [badge(100, [0, 0, 0, 2])];
    const theirs = [badge(100, [0, 0, 2, 2])];

    const fair = computeMatches(mine, theirs, 0, deps({ isMatchEverything: () => false }));
    const any = computeMatches(mine, theirs, 0, deps({ isMatchEverything: () => true }));

    assert.equal(cardCount(fair.itemsToSend), 0, "fair bot declines the unbalanced swap");
    assert.equal(cardCount(fair.itemsToReceive), 0);
    assert.equal(cardCount(any.itemsToSend), 1, "ANY bot accepts the same swap");
    assert.equal(cardCount(any.itemsToReceive), 1);
  });

  it("takes an ANY-mode partner's last copy", () => {
    // Selfish ANY-mode rule: the partner only needs to own the card we need -
    // even their last copy can be taken.
    const mine = [badge(100, [0, 0, 0, 2])];
    const theirs = [badge(100, [0, 0, 1, 0])];
    const result = computeMatches(mine, theirs, 0, deps({ isMatchEverything: () => true }));
    assert.deepEqual(sideShape(result.itemsToSend), ["100-hash-3x1"]);
    assert.deepEqual(sideShape(result.itemsToReceive), ["100-hash-2x1"]);
  });

  it("takes an ANY-mode partner's only copy of a needed card (spec §20 selfish bot)", () => {
    // Ours [A:1,B:2,C:0,D:1,E:1]; partner owns only the needed C:1.
    // Expected: exactly B -> C, although the partner is left with zero C.
    const mine = [badge(100, [1, 2, 0, 1, 1])];
    const theirs = [badge(100, [0, 0, 1, 0, 0])];
    const result = computeMatches(mine, theirs, 0, deps({ isMatchEverything: () => true }));
    assert.deepEqual(sideShape(result.itemsToSend), ["100-hash-1x1"]);
    assert.deepEqual(sideShape(result.itemsToReceive), ["100-hash-2x1"]);
  });

  it("accepts an ANY-mode partner ending with duplicates (spec §20 selfish bot with duplicate)", () => {
    // Ours [A:1,B:2,C:0,D:1,E:1]; partner B:2, C:1.
    // Expected: B -> C still proposed although the partner ends with three B
    // and zero C.
    const mine = [badge(100, [1, 2, 0, 1, 1])];
    const theirs = [badge(100, [0, 2, 1, 0, 0])];
    const result = computeMatches(mine, theirs, 0, deps({ isMatchEverything: () => true }));
    assert.deepEqual(sideShape(result.itemsToSend), ["100-hash-1x1"]);
    assert.deepEqual(sideShape(result.itemsToReceive), ["100-hash-2x1"]);
  });

  it("never takes a fair partner's last copy", () => {
    // The fairness check alone would allow this swap (the partner gains a card
    // they do not own); the retain-one rule must reject it regardless of mode.
    const mine = [badge(100, [0, 0, 0, 2])];
    const theirs = [badge(100, [0, 0, 1, 0])];
    const result = computeMatches(mine, theirs, 0, deps({ isMatchEverything: () => false }));
    assert.deepEqual(result, { itemsToSend: [], itemsToReceive: [] });
  });

  it("keeps offered and requested counts balanced per game", () => {
    const mine = [badge(440, [4, 1, 1, 1]), badge(570, [0, 3, 2, 1])];
    const theirs = [badge(440, [2, 1, 1, 4]), badge(570, [2, 0, 1, 1])];
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

  it("fills every missing card while never requesting an owned-but-held card", () => {
    // User: card 0 x5 (all tradable), card 3 x1 (every copy held); the rest
    // missing. Partner holds two of each. The owned-but-held card 3 must not
    // be requested, so exactly three swaps fill cards 1, 2, and 4.
    // ANY-mode bot: a fair bot would decline later swaps once the copies it
    // received of card 0 catch up with the rest (unchanged fairness rule).
    const mine = [badge(440, [5, 0, 0, 1, 0], [5, 0, 0, 0, 0])];
    const theirs = [badge(440, [0, 2, 2, 2, 2])];
    const result = computeMatches(mine, theirs, 0, deps({ isMatchEverything: () => true }));

    assert.deepEqual(sideShape(result.itemsToSend), ["440-hash-0x3"]);
    assert.deepEqual(sideShape(result.itemsToReceive), ["440-hash-1x1", "440-hash-2x1", "440-hash-4x1"]);
  });

  it("offers the last tradable copy when held copies cover the retained owned one", () => {
    // Retained-owned surplus (openspec change fix-blocked-tradable-offer-sizing):
    // a card is offerable while it owns more than the retained set target and
    // still holds a tradable copy. Five owned copies of card 0 but only one
    // currently tradable: the retained owned copy stays covered by the four
    // held copies, so exactly one swap offers the single tradable copy - and
    // the owned-but-held card 3 is never requested either.
    const mine = [badge(440, [5, 0, 0, 1, 0], [1, 0, 0, 0, 0])];
    const theirs = [badge(440, [0, 2, 2, 2, 2])];
    const result = computeMatches(mine, theirs, 0, deps({ isMatchEverything: () => true }));
    assert.deepEqual(sideShape(result.itemsToSend), ["440-hash-0x1"]);
    assert.deepEqual(sideShape(result.itemsToReceive), ["440-hash-1x1"]);
  });

  it("offers every tradable copy above the retained owned count", () => {
    // User: card 0 owned x4 of which two are held (tradable = 2, owned surplus
    // = 3 above the retained copy), single copies of cards 1 and 2, cards 3
    // and 4 missing. Both tradable copies are offered across exactly two
    // swaps; no held copy is ever sent.
    const mine = [badge(440, [4, 1, 1, 0, 0], [2, 1, 1, 0, 0])];
    const theirs = [badge(440, [0, 2, 2, 2, 2])];
    const result = computeMatches(mine, theirs, 0, deps({ isMatchEverything: () => true }));

    assert.deepEqual(sideShape(result.itemsToSend), ["440-hash-0x2"]);
    assert.deepEqual(sideShape(result.itemsToReceive), ["440-hash-3x1", "440-hash-4x1"]);
  });

  it("offers the single tradable copy above retained owned copies (reported 4xA, 3 held)", () => {
    // Reported Zombie-game case: four owned copies of Card A of which three
    // are temporarily held (tradable = 1, first-set target = 1). The retained
    // owned copy stays covered by the held copies, so the single tradable
    // copy is offerable: exactly one swap, and no held copy is ever sent.
    const mine = [badge(440, [4, 0, 0, 0, 0], [1, 0, 0, 0, 0])];
    const theirs = [badge(440, [1, 1, 1, 1, 1])];
    const result = computeMatches(mine, theirs, 0, deps({ isMatchEverything: () => true }));

    assert.deepEqual(sideShape(result.itemsToSend), ["440-hash-0x1"]);
    assert.deepEqual(sideShape(result.itemsToReceive), ["440-hash-1x1"]);
  });

  it("offers both tradable copies above retained owned copies (reported 4xA, 2 held)", () => {
    // Second reported case: four owned copies of Card A of which two are
    // temporarily held (tradable = 2). Both tradable copies sit above the
    // retained owned copy: exactly two swaps, and no held copy is ever sent.
    const mine = [badge(440, [4, 0, 0, 0, 0], [2, 0, 0, 0, 0])];
    const theirs = [badge(440, [1, 1, 1, 1, 1])];
    const result = computeMatches(mine, theirs, 0, deps({ isMatchEverything: () => true }));

    assert.deepEqual(sideShape(result.itemsToSend), ["440-hash-0x2"]);
    assert.deepEqual(sideShape(result.itemsToReceive), ["440-hash-1x1", "440-hash-2x1"]);
  });

  it("fallback capacity equals owned copies above the target when no tradable counts exist", () => {
    // Badge-page fallback: no tradableCount arrays, so tradable = owned and the
    // surplus rule reduces to owned - target (state 1 target = lastSet = 2 for
    // [4,1,1,1]), i.e. exactly two offers of card 0 before the badge evens out.
    const mine = [badge(440, [4, 1, 1, 1])];
    const theirs = [badge(440, [2, 2, 2, 4])];
    const result = computeMatches(mine, theirs, 0, deps({ isMatchEverything: () => true }));

    assert.deepEqual(sideShape(result.itemsToSend), ["440-hash-0x2"]);
    assert.deepEqual(sideShape(result.itemsToReceive), ["440-hash-1x1", "440-hash-3x1"]);
  });

  it("treats missing tradableCount as fully tradable owned copies", () => {
    const owned = [4, 1, 1, 1];
    const withCapacity = computeMatches(
      [badge(440, owned, owned)],
      [badge(440, [1, 1, 1, 4])],
      0,
      deps({ isMatchEverything: () => true }),
    );
    const withoutCapacity = computeMatches(
      [badge(440, owned)],
      [badge(440, [1, 1, 1, 4])],
      0,
      deps({ isMatchEverything: () => true }),
    );
    assert.deepEqual(sideShape(withCapacity.itemsToSend), sideShape(withoutCapacity.itemsToSend));
    assert.deepEqual(sideShape(withCapacity.itemsToReceive), sideShape(withoutCapacity.itemsToReceive));
  });

  it("lets a single-tradable-duplicate badge through the scanner's nothing-to-match filter", () => {
    // Mirrors the scanner (src/ASF-STM.ts): badges whose sorted owned counts
    // span less than 2 are dropped, and maxSets/lastSet are derived from the
    // owned counts. Scenario (b)'s owned counts [5,0,0,1,0] span 5, so the
    // badge survives the owned-count filter - and under the retained-owned
    // surplus its single tradable copy sits above the held-covered retained
    // copy, so the matcher yields exactly one swap (the eligibility gate
    // includes this badge before matching).
    const mine = badge(440, [5, 0, 0, 1, 0], [1, 0, 0, 0, 0]);
    const span = mine.cards[0]!.count - mine.cards[mine.cards.length - 1]!.count;
    assert.ok(span >= 2, "badge must survive the nothing-to-match filter");
    assert.equal(mine.maxSets, 1);
    assert.equal(mine.lastSet, 2);
    const result = computeMatches([mine], [badge(440, [0, 2, 2, 2, 2])], 0, deps());
    assert.equal(cardCount(result.itemsToSend), 1, "one tradable copy above the retained owned one");
    assert.equal(cardCount(result.itemsToReceive), 1);
  });

  it("keeps held cards out for fair bots while capping offers at tradable capacity", () => {
    // Scenario 1 against a fair (non-ANY) bot: the bot-side fairness check
    // declines the third swap once received Card A catches up, so exactly two
    // swaps result — and none requests the owned-but-held card 3.
    const mine = [badge(440, [5, 0, 0, 1, 0], [5, 0, 0, 0, 0])];
    const theirs = [badge(440, [0, 2, 2, 2, 2])];
    const result = computeMatches(mine, theirs, 0, deps({ isMatchEverything: () => false }));

    assert.deepEqual(sideShape(result.itemsToSend), ["440-hash-0x2"]);
    assert.deepEqual(sideShape(result.itemsToReceive), ["440-hash-1x1", "440-hash-2x1"]);
    assert.equal(cardCount(result.itemsToSend), cardCount(result.itemsToReceive));
  });

  it("never re-offers a just-received card across iterations", () => {
    // Multi-swap accounting: sends decrement owned+tradable, receives increment
    // both — yet a received card can never satisfy a later give check, because
    // receives only happen below the set target while gives require surplus
    // above it. Every sent copy here is Card A within its tradable capacity,
    // and the partner holds two copies of every card it gives (retain-one).
    const mine = [badge(7, [4, 0, 0], [4, 0, 0])];
    const theirs = [badge(7, [0, 2, 3])];
    const result = computeMatches(mine, theirs, 0, deps({ isMatchEverything: () => true }));

    assert.deepEqual(sideShape(result.itemsToSend), ["7-hash-0x2"]);
    assert.deepEqual(sideShape(result.itemsToReceive), ["7-hash-1x1", "7-hash-2x1"]);
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

  it("appends hashes missing from the table instead of storing -1", () => {
    const table: string[] = [];
    const ids = resolveCardIds(
      [{ appId: 1, title: "t", cards: [{ item: "x", count: 1, iconUrl: "", hash: "zz" }] }],
      table,
    );
    assert.deepEqual(ids, [0]);
    assert.deepEqual(table, ["zz"]);
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
