// Unit tests for the browser-persisted badge card cache (src/lib/dataset.ts).
//
// Run with exactly one command from the repo root:
//
//   pnpm test

import { describe, it } from "vitest";
import assert from "node:assert/strict";

import {
  diffNewBadgeCardEntries,
  normalizeDataset,
  readBadgeCardCache,
  serializeBadgeCardsExport,
  writeBadgeCardCacheEntry,
} from "../src/lib/dataset";
import type { BadgeCardCache, BadgeDataset } from "../src/lib/dataset";
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

describe("new badge-card entries diff", () => {
  const bundled: BadgeDataset = {
    440: {
      size: 5,
      name: "Bundled Game",
      cards: [{ hash: "440-A", title: "Card A", iconUrl: "https://example.test/a.jpg" }],
    },
    570: { size: 6 },
  };

  it("treats an unbundled cached game as new", () => {
    const cache: BadgeCardCache = {
      753: { size: 5, cards: [{ hash: "753-A", title: "Card A" }] },
    };
    assert.deepEqual(diffNewBadgeCardEntries(bundled, cache), {
      753: { size: 5, cards: [{ hash: "753-A", title: "Card A" }] },
    });
  });

  it("treats a rich cache entry as an upgrade over a size-only bundled entry", () => {
    const cache: BadgeCardCache = {
      570: { size: 6, name: "Learned Name", cards: [{ hash: "570-A" }] },
    };
    assert.deepEqual(diffNewBadgeCardEntries(bundled, cache), {
      570: { size: 6, name: "Learned Name", cards: [{ hash: "570-A" }] },
    });
  });

  it("suppresses a cached game fully covered by a bundled rich entry", () => {
    const cache: BadgeCardCache = {
      440: { size: 5, cards: [{ hash: "440-A" }] },
    };
    assert.deepEqual(diffNewBadgeCardEntries(bundled, cache), {});
  });

  it("ignores size-only cache entries where the bundle is also size-only", () => {
    const cache: BadgeCardCache = {
      570: { size: 6 },
    };
    assert.deepEqual(diffNewBadgeCardEntries(bundled, cache), {});
  });

  it("skips cache entries without a usable set size", () => {
    const cache: BadgeCardCache = {
      753: { name: "Nameless size" },
    };
    assert.deepEqual(diffNewBadgeCardEntries(bundled, cache), {});
  });

  it("diffs a corrupt cache to zero new entries", () => {
    const storage = fakeStorage({ "TempAsfStm.ASF.STM.BadgeCards.v1": "not json" });
    assert.deepEqual(diffNewBadgeCardEntries(bundled, readBadgeCardCache(storage)), {});
  });
});

describe("badge-cards export serializer", () => {
  it("emits long keys with full icon URLs", () => {
    const json = serializeBadgeCardsExport({
      753: {
        size: 5,
        name: "Exported Game",
        cards: [{ hash: "753-A", title: "Card A", iconUrl: "/tail-a.jpg" }],
      },
    });
    const parsed = JSON.parse(json) as Record<string, Record<string, unknown>>;
    assert.deepEqual(Object.keys(parsed), ["753"]);
    assert.equal(parsed["753"]!["size"], 5);
    assert.equal(parsed["753"]!["name"], "Exported Game");
    const cards = parsed["753"]!["cards"] as Array<Record<string, unknown>>;
    assert.equal(cards.length, 1);
    assert.equal(cards[0]!["hash"], "753-A");
    assert.equal(cards[0]!["title"], "Card A");
    assert.ok((cards[0]!["iconUrl"] as string).startsWith("https://"));
    assert.ok((cards[0]!["iconUrl"] as string).endsWith("/tail-a.jpg"));
  });

  it("round-trips through normalizeDataset with identical card data", () => {
    const cache: BadgeCardCache = {
      753: {
        size: 5,
        name: "Exported Game",
        cards: [{ hash: "753-A", title: "Card A", iconUrl: "https://example.test/full-a.jpg" }, { hash: "753-B" }],
      },
    };
    const exported = JSON.parse(serializeBadgeCardsExport(diffNewBadgeCardEntries({}, cache))) as unknown;
    const reloaded = normalizeDataset(exported);
    assert.equal(reloaded["753"]?.size, 5);
    assert.equal(reloaded["753"]?.name, "Exported Game");
    assert.deepEqual(reloaded["753"]?.cards, [
      { hash: "753-A", title: "Card A", iconUrl: "https://example.test/full-a.jpg" },
      { hash: "753-B" },
    ]);
  });

  it("exports only the new entries, never the whole cache", () => {
    const bundled: BadgeDataset = {
      440: { size: 5, cards: [{ hash: "440-A" }] },
    };
    const cache: BadgeCardCache = {
      440: { size: 5, cards: [{ hash: "440-A" }] },
      753: { size: 5, cards: [{ hash: "753-A" }] },
    };
    const parsed = JSON.parse(serializeBadgeCardsExport(diffNewBadgeCardEntries(bundled, cache))) as Record<
      string,
      unknown
    >;
    assert.deepEqual(Object.keys(parsed), ["753"]);
  });
});
