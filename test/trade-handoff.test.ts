// Unit tests for the trade-offer page handoff (src/lib/matcher-core.ts).
//
// Run with exactly one command from the repo root:
//
//   pnpm test
//
// Plain fixtures, no browser/network. Covers openspec change
// fix-tradeoffer-empty-selection: match=all and match=<appid> URL forms in
// bot mode (truncated partner) and friend mode (full SteamID), plus every
// loud-abort path.

import { describe, it } from "vitest";
import assert from "node:assert/strict";

import { getPartner } from "../src/lib/helpers";
import {
  decodeStoredCardName,
  resolvePartnerMatches,
  resolveTradeCards,
  resolveTradeFilter,
  tradePartnerKeyCandidates,
  type TradePageStore,
} from "../src/lib/matcher-core";

const FULL_STEAM_ID = "76561198012345678";
const TRUNCATED = getPartner(FULL_STEAM_ID);

function store(): TradePageStore {
  const cardNames = [
    encodeURIComponent("Game A-Card 1"),
    encodeURIComponent("Game A-Card 2"),
    encodeURIComponent("Game B-Card 1"),
  ];
  return {
    cardNames,
    filter: [100, 200],
    matches: {
      [TRUNCATED]: {
        "100": { send: [0], receive: [1] },
        "200": { send: [2], receive: [2] },
      },
    },
  };
}

describe("resolveTradeFilter", () => {
  it("selects the whole persisted filter for match=all", () => {
    assert.deepEqual(resolveTradeFilter("all", [100, 200]), [100, 200]);
  });

  it("selects exactly one badge for match=<appid>", () => {
    assert.deepEqual(resolveTradeFilter("200", [100, 200]), [200]);
  });

  it("throws on a missing match param", () => {
    assert.throws(() => resolveTradeFilter(undefined, [100]), /missing url parameter/);
  });

  it("throws on a non-numeric match param", () => {
    assert.throws(() => resolveTradeFilter("abc", [100]), /invalid url parameter/);
  });
});

describe("resolvePartnerMatches", () => {
  it("finds bot-mode matches by truncated partner id", () => {
    const s = store();
    assert.deepEqual(resolvePartnerMatches(s.matches, TRUNCATED, getPartner), s.matches[TRUNCATED]);
  });

  it("finds the same matches by full SteamID (friend-mode URL)", () => {
    const s = store();
    assert.deepEqual(resolvePartnerMatches(s.matches, FULL_STEAM_ID, getPartner), s.matches[TRUNCATED]);
  });

  it("tolerates a twice-truncated key", () => {
    const s = store();
    const twice = getPartner(TRUNCATED);
    assert.deepEqual(resolvePartnerMatches(s.matches, twice, getPartner), s.matches[TRUNCATED]);
  });

  it("throws loudly for an unknown partner", () => {
    const s = store();
    assert.throws(() => resolvePartnerMatches(s.matches, "99999999", getPartner), /no matches with this partner/);
  });

  it("lists raw, truncated, and twice-truncated candidates", () => {
    const candidates = tradePartnerKeyCandidates(FULL_STEAM_ID, getPartner);
    assert.ok(candidates.includes(FULL_STEAM_ID));
    assert.ok(candidates.includes(TRUNCATED));
  });
});

describe("resolveTradeCards", () => {
  it("fills both sides for match=all", () => {
    const s = store();
    const matches = resolvePartnerMatches(s.matches, FULL_STEAM_ID, getPartner);
    const [send, receive] = resolveTradeCards(matches, resolveTradeFilter("all", s.filter), s.cardNames);
    assert.deepEqual(send, ["Game A-Card 1", "Game B-Card 1"]);
    assert.deepEqual(receive, ["Game A-Card 2", "Game B-Card 1"]);
  });

  it("fills only the requested badge for match=<appid>", () => {
    const s = store();
    const matches = resolvePartnerMatches(s.matches, TRUNCATED, getPartner);
    const [send, receive] = resolveTradeCards(matches, resolveTradeFilter("100", s.filter), s.cardNames);
    assert.deepEqual(send, ["Game A-Card 1"]);
    assert.deepEqual(receive, ["Game A-Card 2"]);
  });

  it("skips filter appids without a match entry, then aborts when empty", () => {
    const s = store();
    const matches = resolvePartnerMatches(s.matches, TRUNCATED, getPartner);
    assert.throws(() => resolveTradeCards(matches, [999], s.cardNames), /nothing to add, exiting/);
  });

  it("aborts loudly when unbalanced", () => {
    const s = store();
    const matches = { "100": { send: [0, 1], receive: [1] } };
    assert.throws(() => resolveTradeCards(matches, [100], s.cardNames), /Different items amount/);
  });

  it("skips unknown card ids and reports them", () => {
    const s = store();
    const skipped: number[] = [];
    assert.equal(
      decodeStoredCardName(s.cardNames, 99, (card) => skipped.push(card)),
      undefined,
    );
    assert.deepEqual(skipped, [99]);
  });

  it("falls back to the raw name when decoding fails", () => {
    assert.equal(decodeStoredCardName(["100% broken"], 0), "100% broken");
  });
});
