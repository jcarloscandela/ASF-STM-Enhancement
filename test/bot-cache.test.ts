// Unit tests for the bot-listing cache helper (src/lib/bot-cache.ts):
// freshness window, mode match, Stop invalidation, and survival of
// unrelated keys. No browser, no network.
//
// Run with exactly one command from the repo root:
//
//   pnpm test

import { describe, it } from "vitest";
import assert from "node:assert/strict";

import { clearBotCache, loadBotCache, saveBotCache } from "../src/lib/bot-cache";
import type { BotsResponse } from "../src/lib/models";
import { readJson, STORAGE_KEYS, writeJson, type StorageLike } from "../src/lib/storage";

function fakeStorage(seed: Record<string, string> = {}): StorageLike {
  const data = new Map(Object.entries(seed));
  return {
    getItem: (key: string) => (data.has(key) ? data.get(key)! : null),
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

function botsResponse(): BotsResponse {
  return { Success: true, Result: [], friends: false };
}

const TTL = 5 * 60000;

describe("loadBotCache", () => {
  it("returns a fresh same-mode snapshot", () => {
    const storage = fakeStorage();
    saveBotCache(storage, botsResponse(), 1000);
    assert.deepEqual(loadBotCache(storage, 1000 + TTL - 1, TTL, false), {
      Success: true,
      Result: [],
      friends: false,
      cacheTime: 1000,
    });
  });

  it("returns null when stale, mode-mismatched, absent, or corrupt", () => {
    const storage = fakeStorage();
    saveBotCache(storage, botsResponse(), 1000);
    assert.equal(loadBotCache(storage, 1000 + TTL + 1, TTL, false), null);
    assert.equal(loadBotCache(storage, 1000, TTL, true), null);
    assert.equal(loadBotCache(fakeStorage(), 1000, TTL, false), null);
    assert.equal(loadBotCache(fakeStorage({ [STORAGE_KEYS.botCache]: "not-json{" }), 1000, TTL, false), null);
  });
});

describe("clearBotCache (Stop)", () => {
  it("empties the persisted layer so the next scan refetches", () => {
    const storage = fakeStorage();
    saveBotCache(storage, botsResponse(), 1000);
    assert.notEqual(loadBotCache(storage, 1000, TTL, false), null);
    clearBotCache(storage);
    assert.equal(loadBotCache(storage, 1000, TTL, false), null);
  });

  it("leaves settings, blacklist, badge cards, and params untouched", () => {
    const storage = fakeStorage();
    saveBotCache(storage, botsResponse(), 1000);
    writeJson(storage, STORAGE_KEYS.settings, { matchFriends: false });
    writeJson(storage, STORAGE_KEYS.blacklist, ["123"]);
    writeJson(storage, STORAGE_KEYS.badgeCards, { "10": { size: 5 } });
    writeJson(storage, STORAGE_KEYS.params, { filter: [10] });
    clearBotCache(storage);
    assert.deepEqual(readJson(storage, STORAGE_KEYS.settings, null), { matchFriends: false });
    assert.deepEqual(readJson(storage, STORAGE_KEYS.blacklist, null), ["123"]);
    assert.deepEqual(readJson(storage, STORAGE_KEYS.badgeCards, null), { "10": { size: 5 } });
    assert.deepEqual(readJson(storage, STORAGE_KEYS.params, null), { filter: [10] });
  });
});
