// @vitest-environment happy-dom
//
// Golden + fixture tests for the gamecards-page parser (src/lib/badge-page.ts).
// Slice 2.1 of modularize-userscript-services: outputs must replay the inline
// `GetCards` parsing exactly (quantities, titles, icons, unmatched detection).
//
// Run with exactly one command from the repo root:
//
//   pnpm test

import { describe, it } from "vitest";
import assert from "node:assert/strict";

import {
  applyBadgeSetSizes,
  hasMatchableDistribution,
  parseGamecardsPage,
  sortBadgeCardsDesc,
} from "../src/lib/badge-page";

function doc(html: string): ParentNode {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;
  return wrapper;
}

const OWN = [
  { item: "Game X: Card Alpha", hash: "Game X-Card Alpha", number: 0 },
  { item: "Game X: Card Beta", hash: "Game X-Card Beta", number: 1 },
  { item: "Game X: Card Gamma", hash: "Game X-Card Gamma", number: 2 },
  { item: "Game X: Card Delta", hash: "Game X-Card Delta", number: 3 },
  { item: "Game X: Card Epsilon", hash: "Game X-Card Epsilon", number: 4 },
];

function cardRow(title: string, qty?: string, icon?: string): string {
  return `<div class="badge_card_set_card">
    <div class="badge_card_set_title">${title}</div>
    <img class="gamecard" src="${icon ?? "https://cdn/x.jpg"}">
    ${qty === undefined ? "" : `<div class="badge_card_set_text_qty">${qty}</div>`}
  </div>`;
}

describe("parseGamecardsPage", () => {
  it("parses quantities, titles, and icons for every slot", () => {
    const html =
      cardRow("Card Alpha", "(2)") +
      cardRow("Card Beta", "(0)") +
      cardRow("Card Gamma", "(3)") +
      cardRow("Card Delta", "(1)") +
      cardRow("Card Epsilon", "(2)");
    const result = parseGamecardsPage(doc(html), OWN);
    assert.equal(result.kind, "ok");
    if (result.kind !== "ok") return;
    assert.equal(result.maxCards, 5);
    assert.deepEqual(
      result.cards.map((c) => [c.item, c.count, c.hash, c.number]),
      [
        ["Card Alpha", 2, "Game X-Card Alpha", 0],
        ["Card Beta", 0, "Game X-Card Beta", 1],
        ["Card Gamma", 3, "Game X-Card Gamma", 2],
        ["Card Delta", 1, "Game X-Card Delta", 3],
        ["Card Epsilon", 2, "Game X-Card Epsilon", 4],
      ],
    );
    assert.ok(result.cards.every((c) => c.iconUrl === "https://cdn/x.jpg"));
  });

  it("counts a missing quantity element as zero owned", () => {
    const html =
      cardRow("Card Alpha") +
      cardRow("Card Beta", "(1)") +
      cardRow("Card Gamma", "(1)") +
      cardRow("Card Delta", "(1)") +
      cardRow("Card Epsilon", "(1)");
    const result = parseGamecardsPage(doc(html), OWN);
    assert.equal(result.kind, "ok");
    if (result.kind !== "ok") return;
    assert.equal(result.cards[0]!.count, 0);
  });

  it("maps exact titles and suffix titles to user hashes", () => {
    const exact = [{ item: "Card Alpha", hash: "h-alpha", number: 0 }];
    const html =
      cardRow("Card Alpha", "(1)") +
      cardRow("Card Beta", "(1)") +
      cardRow("Card Gamma", "(1)") +
      cardRow("Card Delta", "(1)") +
      cardRow("Card Epsilon", "(1)");
    const own = [
      ...exact,
      { item: "b", hash: "h-b", number: 1 },
      { item: "c", hash: "h-c", number: 2 },
      { item: "d", hash: "h-d", number: 3 },
      { item: "e", hash: "h-e", number: 4 },
    ];
    const suffixOwn = OWN;
    const r1 = parseGamecardsPage(doc(html), own);
    assert.equal(r1.kind, "unmatched");
    const r2 = parseGamecardsPage(doc(html), suffixOwn);
    assert.equal(r2.kind, "ok");
    if (r2.kind !== "ok") return;
    assert.equal(r2.cards[0]!.hash, "Game X-Card Alpha");
  });

  it("reports the unmatched card and skips the badge", () => {
    const html =
      cardRow("Card Alpha", "(1)") +
      cardRow("Mystery Card", "(9)") +
      cardRow("Card Gamma", "(1)") +
      cardRow("Card Delta", "(1)") +
      cardRow("Card Epsilon", "(1)");
    const result = parseGamecardsPage(doc(html), OWN);
    assert.deepEqual(result, { kind: "unmatched", unmatched: "Mystery Card" });
  });

  it("reports too-few slots for short pages", () => {
    const html = cardRow("Card Alpha", "(1)") + cardRow("Card Beta", "(1)");
    assert.deepEqual(parseGamecardsPage(doc(html), OWN), { kind: "too-few", found: 2 });
  });
});

describe("badge ordering and set sizes", () => {
  function badge(counts: number[]): {
    maxCards: number;
    maxSets: number;
    lastSet: number;
    cards: Array<{ count: number }>;
  } {
    return { maxCards: counts.length, maxSets: 0, lastSet: 0, cards: counts.map((count) => ({ count })) };
  }

  it("sorts slots descending before deciding", () => {
    const b = badge([0, 2, 2, 2, 2]);
    sortBadgeCardsDesc(b);
    assert.deepEqual(
      b.cards.map((c) => c.count),
      [2, 2, 2, 2, 0],
    );
  });

  it("rejects flat distributions (2/2/2/2/2 needs nothing)", () => {
    const b = badge([2, 2, 2, 2, 2]);
    sortBadgeCardsDesc(b);
    assert.equal(hasMatchableDistribution(b), false);
  });

  it("rejects spread-1 distributions", () => {
    const b = badge([1, 1, 1, 1, 2]);
    sortBadgeCardsDesc(b);
    assert.equal(hasMatchableDistribution(b), false);
  });

  it("accepts unbalanced distributions (0/2/2/2/2 and 1/3/1/2/0)", () => {
    for (const counts of [
      [0, 2, 2, 2, 2],
      [1, 3, 1, 2, 0],
    ]) {
      const b = badge(counts);
      sortBadgeCardsDesc(b);
      assert.equal(hasMatchableDistribution(b), true);
    }
  });

  it("derives even set targets from sorted slots", () => {
    const b = badge([2, 2, 2, 2, 2]);
    sortBadgeCardsDesc(b);
    assert.equal(applyBadgeSetSizes(b), 10);
    assert.equal(b.maxSets, 2);
    assert.equal(b.lastSet, 2);
  });

  it("rounds the last set up for uneven totals", () => {
    const b = badge([3, 2, 2, 2, 2]);
    sortBadgeCardsDesc(b);
    assert.equal(applyBadgeSetSizes(b), 11);
    assert.equal(b.maxSets, 2);
    assert.equal(b.lastSet, 3);
  });
});
