// Unit tests for the private-bots rescue list (src/lib/private-bots.ts):
// upsert/remove semantics, corrupt tolerance, cache-first backfill.
// No browser, no network.

import { describe, it } from "vitest";
import assert from "node:assert/strict";

import {
  backfillFromBotList,
  listPrivateBots,
  needsBackfill,
  parseProfileDisplay,
  readPrivateBots,
  removePrivateBot,
  upsertPrivateBot,
  writePrivateBots,
  type PrivateBotRecord,
} from "../src/lib/private-bots";
import { STORAGE_KEYS, type StorageLike } from "../src/lib/storage";

function fakeStorage(seed: Record<string, string> = {}): StorageLike {
  const data = new Map(Object.entries(seed));
  return {
    getItem: (key: string) => (data.has(key) ? data.get(key)! : null),
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

describe("upsertPrivateBot", () => {
  it("records a snapshot with timestamps", () => {
    const record: PrivateBotRecord = {};
    const entry = upsertPrivateBot(
      record,
      { SteamID: "123", Nickname: "Bot", AvatarHash: "abc", TotalInventoryCount: 42 },
      1000,
    );
    assert.equal(entry.steamId, "123");
    assert.equal(entry.nickname, "Bot");
    assert.equal(entry.firstSeen, 1000);
    assert.equal(entry.lastSeen, 1000);
  });

  it("keeps firstSeen and advances lastSeen without duplicating", () => {
    const record: PrivateBotRecord = {};
    upsertPrivateBot(record, { SteamID: "123", Nickname: "Bot" }, 1000);
    upsertPrivateBot(record, { SteamID: "123", Nickname: "Bot2", TotalInventoryCount: 7 }, 2000);
    assert.equal(Object.keys(record).length, 1);
    assert.equal(record["123"]!.firstSeen, 1000);
    assert.equal(record["123"]!.lastSeen, 2000);
    assert.equal(record["123"]!.nickname, "Bot");
    assert.equal(record["123"]!.totalItems, 7);
  });
});

describe("removePrivateBot", () => {
  it("deletes existing entries and reports missing ones", () => {
    const record: PrivateBotRecord = {};
    upsertPrivateBot(record, { SteamID: "1" }, 1);
    assert.equal(removePrivateBot(record, "1"), true);
    assert.equal(removePrivateBot(record, "1"), false);
    assert.deepEqual(record, {});
  });
});

describe("persistence", () => {
  it("round-trips through storage", () => {
    const storage = fakeStorage();
    const record: PrivateBotRecord = {};
    upsertPrivateBot(record, { SteamID: "9", Nickname: "N" }, 5);
    writePrivateBots(storage, record);
    assert.deepEqual(readPrivateBots(storage), record);
  });

  it("tolerates absent, corrupt, and mismatched content", () => {
    assert.deepEqual(readPrivateBots(fakeStorage()), {});
    assert.deepEqual(readPrivateBots(fakeStorage({ [STORAGE_KEYS.privateBots]: "not-json{" })), {});
    assert.deepEqual(readPrivateBots(fakeStorage({ [STORAGE_KEYS.privateBots]: '"v2-shape"' })), {});
    assert.deepEqual(
      readPrivateBots(fakeStorage({ [STORAGE_KEYS.privateBots]: JSON.stringify({ x: { steamId: "y" } }) })),
      {},
    );
  });
});

describe("backfill", () => {
  it("fills missing display data from the bot cache", () => {
    const record: PrivateBotRecord = {};
    upsertPrivateBot(record, { SteamID: "1" }, 1);
    upsertPrivateBot(record, { SteamID: "2", Nickname: "Known", AvatarHash: "h" }, 1);
    const unresolved = backfillFromBotList(record, [
      {
        SteamID: "1",
        Nickname: "Cached",
        AvatarHash: "hash1",
        MatchEverything: true,
        TotalInventoryCount: 10,
        MatchableTypes: [],
      },
    ]);
    assert.equal(record["1"]!.nickname, "Cached");
    assert.equal(needsBackfill(record["1"]!), false);
    assert.deepEqual(unresolved, []);
  });

  it("leaves unknown IDs unresolved without blocking others", () => {
    const record: PrivateBotRecord = {};
    upsertPrivateBot(record, { SteamID: "ghost" }, 1);
    const unresolved = backfillFromBotList(record, []);
    assert.deepEqual(unresolved, ["ghost"]);
    assert.equal(needsBackfill(record["ghost"]!), true);
  });

  it("sorts newest lastSeen first", () => {
    const record: PrivateBotRecord = {};
    upsertPrivateBot(record, { SteamID: "old" }, 1);
    upsertPrivateBot(record, { SteamID: "new" }, 99);
    assert.deepEqual(
      listPrivateBots(record).map((e) => e.steamId),
      ["new", "old"],
    );
  });
});

describe("parseProfileDisplay", () => {
  it("extracts nickname and avatar hash from profile HTML", () => {
    const html = `<html><head><title>Steam Community :: SomeBot</title><meta property="og:image" content="https://avatars.cloudflare.steamstatic.com/abcdef1234567890abcdef1234567890_full.jpg" /></head></html>`;
    assert.deepEqual(parseProfileDisplay(html), {
      nickname: "SomeBot",
      avatarHash: "abcdef1234567890abcdef1234567890",
    });
  });

  it("returns nulls and never throws on unrecognized pages", () => {
    assert.deepEqual(parseProfileDisplay("<html></html>"), { nickname: null, avatarHash: null });
    assert.deepEqual(parseProfileDisplay(""), { nickname: null, avatarHash: null });
  });
});
