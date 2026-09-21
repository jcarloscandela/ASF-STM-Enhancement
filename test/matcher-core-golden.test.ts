// Golden-equivalence test for the extracted matcher core.
//
// The reference implementation below mirrors the userscript matching bodies
// (originally extracted verbatim from `src/ASF-STM.ts`, commit 811c688) with
// the owned/tradable counting semantics from openspec change
// fix-matcher-tradable-counts applied: owned copies drive the badge state and
// the need checks, and a per-slot tradable remainder caps offers (falling back
// to the owned count when no tradable count is present). matcher-core must
// produce identical results across exhaustive small fixtures, so any later
// "optimization" of the core is caught.

import { describe, it } from "vitest";
import assert from "node:assert/strict";

import { computeMatches, type MatchBadge, type MatchCard } from "../src/lib/matcher-core";

// --- reference implementation ------------------------------------------------

interface RefCard {
  item: string;
  hash: string;
  count: number;
  tradableCount?: number;
  iconUrl: string;
  number: number;
}
interface RefWorkCard extends RefCard {
  tradableRemaining: number;
}
interface RefBadge {
  appId: number;
  title: string;
  maxCards: number;
  maxSets: number;
  lastSet: number;
  cards: RefCard[];
}
interface RefWorkBadge extends RefBadge {
  cards: RefWorkCard[];
}
interface RefItem {
  appId: number;
  title: string;
  cards: Array<{ item: string; count: number; iconUrl: string; hash: string }>;
}

function refCalcState(badge: RefBadge): number {
  if (badge.cards[badge.maxCards - 1]!.count === badge.maxSets) {
    if (badge.cards[0]!.count === badge.lastSet) {
      return 2;
    }
    return 1;
  }
  return 0;
}

function refCompareCards(
  myBadges: RefBadge[],
  botBadges: RefBadge[],
  index: number,
  isMatchEverything: (i: number) => boolean,
): { itemsToSend: RefItem[]; itemsToReceive: RefItem[] } {
  const itemsToSend: RefItem[] = [];
  const itemsToReceive: RefItem[] = [];

  for (let i = 0; i < botBadges.length; i++) {
    const myBadge = JSON.parse(JSON.stringify(myBadges[i])) as RefWorkBadge;
    const theirBadge = JSON.parse(JSON.stringify(botBadges[i])) as RefBadge;
    // Owned counts drive state and need checks; the tradable remainder caps
    // offers, clamped by the owned count.
    for (const card of myBadge.cards) {
      card.tradableRemaining = Math.min(card.tradableCount ?? card.count, card.count);
    }
    let myState = refCalcState(myBadge);
    while (myState < 2) {
      let foundMatch = false;
      for (let j = 0; j < theirBadge.maxCards; j++) {
        if (theirBadge.cards[j]!.count > 0) {
          const myInd = myBadge.cards.findIndex((a) => a.number === theirBadge.cards[j]!.number);
          if (
            (myState === 0 && myBadge.cards[myInd]!.count < myBadge.maxSets) ||
            (myState === 1 && myBadge.cards[myInd]!.count < myBadge.lastSet)
          ) {
            for (let k = 0; k < myInd; k++) {
              if (
                ((myState === 0 && myBadge.cards[k]!.count > myBadge.maxSets) ||
                  (myState === 1 && myBadge.cards[k]!.count > myBadge.lastSet)) &&
                myBadge.cards[k]!.tradableRemaining > 0
              ) {
                const theirInd = theirBadge.cards.findIndex((a) => a.number === myBadge.cards[k]!.number);
                if (!isMatchEverything(index)) {
                  if (theirBadge.cards[theirInd]!.count >= theirBadge.cards[j]!.count) {
                    continue;
                  }
                }
                const itemToSend = {
                  item: myBadge.cards[k]!.item,
                  count: 1,
                  iconUrl: myBadge.cards[k]!.iconUrl,
                  hash: myBadge.cards[k]!.hash,
                };
                const itemToReceive = {
                  item: theirBadge.cards[j]!.item,
                  count: 1,
                  iconUrl: theirBadge.cards[j]!.iconUrl,
                  hash: theirBadge.cards[j]!.hash,
                };
                const sendmatch = itemsToSend.find((item) => item.appId == myBadge.appId);
                if (sendmatch === undefined) {
                  itemsToSend.push({ appId: myBadge.appId, title: myBadge.title, cards: [itemToSend] });
                } else {
                  const existingCard = sendmatch.cards.find((a) => a.hash === itemToSend.hash);
                  if (existingCard === undefined) {
                    sendmatch.cards.push(itemToSend);
                  } else {
                    existingCard.count += 1;
                  }
                }
                theirBadge.cards[theirInd]!.count += 1;
                myBadge.cards[k]!.count -= 1;
                myBadge.cards[k]!.tradableRemaining -= 1;

                const receiveMatch = itemsToReceive.find((item) => item.appId == myBadge.appId);
                if (receiveMatch === undefined) {
                  itemsToReceive.push({ appId: myBadge.appId, title: myBadge.title, cards: [itemToReceive] });
                } else {
                  const existingCard = receiveMatch.cards.find((a) => a.hash === itemToReceive.hash);
                  if (existingCard === undefined) {
                    receiveMatch.cards.push(itemToReceive);
                  } else {
                    existingCard.count += 1;
                  }
                }
                myBadge.cards[myInd]!.count += 1;
                myBadge.cards[myInd]!.tradableRemaining += 1;
                theirBadge.cards[j]!.count -= 1;
                foundMatch = true;
                break;
              }
            }
          }
        }
        if (foundMatch) {
          myBadge.cards.sort((a, b) => b.count - a.count);
          myState = refCalcState(myBadge);
        }
      }
      if (!foundMatch) {
        break;
      }
      theirBadge.cards.sort((a, b) => b.count - a.count);
    }
  }

  return { itemsToSend, itemsToReceive };
}

// --- fixtures ----------------------------------------------------------------

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

const sideShape = (items: Array<{ cards: Array<{ hash: string; count: number }> }>): string[] =>
  items.flatMap((item) => item.cards.map((card) => `${card.hash}x${card.count}`)).sort();

function allCounts(slotCount: number, maxPerSlot: number): number[][] {
  const out: number[][] = [];
  const walk = (prefix: number[]): void => {
    if (prefix.length === slotCount) {
      out.push(prefix);
      return;
    }
    for (let v = 0; v <= maxPerSlot; v++) {
      walk([...prefix, v]);
    }
  };
  walk([]);
  return out;
}

describe("matcher-core golden equivalence", () => {
  it("matches the reference algorithm on representative badge pairs", () => {
    // Each entry: [owned counts, partner counts, tradable counts or undefined].
    const fixtures: Array<[number[], number[], number[] | undefined]> = [
      [[2, 2, 2, 2], [3, 1, 1, 1], undefined],
      [[0, 0, 0, 2], [0, 0, 1, 1], undefined],
      [[4, 1, 1, 1], [1, 1, 1, 4], undefined],
      [[1, 2, 2, 4], [4, 2, 1, 1], undefined],
      [[3, 1, 0, 0], [0, 0, 1, 1], undefined],
      // Reported scenario (a): one fully tradable surplus card plus an
      // owned-but-held card fills every missing card.
      [
        [5, 0, 0, 1, 0],
        [0, 2, 2, 2, 2],
        [5, 0, 0, 0, 0],
      ],
      // Reported scenario (b): only one surplus copy tradable - one swap.
      [
        [5, 0, 0, 1, 0],
        [0, 2, 2, 2, 2],
        [1, 0, 0, 0, 0],
      ],
      // Surplus exists only as held copies: nothing offerable.
      [
        [3, 1, 1, 1],
        [1, 1, 1, 3],
        [0, 1, 1, 1],
      ],
    ];

    for (const [mine, theirs, tradable] of fixtures) {
      for (const any of [false, true]) {
        const expected = refCompareCards([badge(100, mine, tradable)], [badge(100, theirs)], 0, () => any);
        const actual = computeMatches([badge(100, mine, tradable)], [badge(100, theirs)], 0, {
          debugPrint: () => {},
          isMatchEverything: () => any,
        });
        assert.deepEqual(
          sideShape(actual.itemsToSend),
          sideShape(expected.itemsToSend),
          `send side: mine=${JSON.stringify(mine)} tradable=${JSON.stringify(tradable)} theirs=${JSON.stringify(
            theirs,
          )} any=${any}`,
        );
        assert.deepEqual(
          sideShape(actual.itemsToReceive),
          sideShape(expected.itemsToReceive),
          `receive side: mine=${JSON.stringify(mine)} tradable=${JSON.stringify(tradable)} theirs=${JSON.stringify(
            theirs,
          )} any=${any}`,
        );
      }
    }
  });

  it("matches the reference algorithm exhaustively over 3-slot fixtures", () => {
    const counts = allCounts(3, 4);
    let compared = 0;
    for (const mine of counts) {
      for (const theirs of counts) {
        for (const any of [false, true]) {
          const expected = refCompareCards([badge(1, mine)], [badge(1, theirs)], 0, () => any);
          const actual = computeMatches([badge(1, mine)], [badge(1, theirs)], 0, {
            debugPrint: () => {},
            isMatchEverything: () => any,
          });
          assert.deepEqual(
            sideShape(actual.itemsToSend),
            sideShape(expected.itemsToSend),
            `send: mine=${JSON.stringify(mine)} theirs=${JSON.stringify(theirs)} any=${any}`,
          );
          assert.deepEqual(
            sideShape(actual.itemsToReceive),
            sideShape(expected.itemsToReceive),
            `receive: mine=${JSON.stringify(mine)} theirs=${JSON.stringify(theirs)} any=${any}`,
          );
          compared++;
        }
      }
    }
    assert.equal(compared, counts.length * counts.length * 2);
  });

  it("matches the reference algorithm exhaustively over 3-slot fixtures with held copies", () => {
    // Enumerates every (owned counts, tradable counts) pair for the user side
    // with tradable <= owned per slot, against every partner distribution.
    // 216 owned/tradable pairs x 27 partner vectors x 2 bot modes.
    const counts = allCounts(3, 2);
    const tradableVectors = allCounts(3, 2);
    let compared = 0;
    for (const mine of counts) {
      for (const tradable of tradableVectors) {
        if (tradable.some((t, slot) => t > mine[slot]!)) {
          continue;
        }
        for (const theirs of counts) {
          for (const any of [false, true]) {
            const expected = refCompareCards([badge(1, mine, tradable)], [badge(1, theirs)], 0, () => any);
            const actual = computeMatches([badge(1, mine, tradable)], [badge(1, theirs)], 0, {
              debugPrint: () => {},
              isMatchEverything: () => any,
            });
            assert.deepEqual(
              sideShape(actual.itemsToSend),
              sideShape(expected.itemsToSend),
              `send: mine=${JSON.stringify(mine)} tradable=${JSON.stringify(tradable)} theirs=${JSON.stringify(
                theirs,
              )} any=${any}`,
            );
            assert.deepEqual(
              sideShape(actual.itemsToReceive),
              sideShape(expected.itemsToReceive),
              `receive: mine=${JSON.stringify(mine)} tradable=${JSON.stringify(tradable)} theirs=${JSON.stringify(
                theirs,
              )} any=${any}`,
            );
            compared++;
          }
        }
      }
    }
    assert.equal(compared, 216 * counts.length * 2);
  });
});
