// Unit tests for the browser-persisted badge card cache (src/lib/dataset.ts).
//
// Run with exactly one command from the repo root:
//
//   pnpm test

import { describe, it } from "vitest";
import assert from "node:assert/strict";

import { readBadgeCardCache, writeBadgeCardCacheEntry } from "../src/lib/dataset";
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
