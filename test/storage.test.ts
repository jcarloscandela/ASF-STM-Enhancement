// Unit tests for the generic storage primitive (src/lib/storage.ts).
//
// Run with exactly one command from the repo root:
//
//   pnpm test
//
// Uses an in-memory fake; no browser or real localStorage.

import { describe, it } from "vitest";
import assert from "node:assert/strict";

import { STORAGE_KEYS, readJson, removeKey, writeJson, type StorageLike } from "../src/lib/storage";

function fakeStorage(seed: Record<string, string> = {}): StorageLike & { dump(): Record<string, string> } {
  const map = new Map<string, string>(Object.entries(seed));
  return {
    getItem: (key) => (map.has(key) ? (map.get(key) as string) : null),
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
    dump: () => Object.fromEntries(map),
  };
}

describe("STORAGE_KEYS", () => {
  it("keeps the persisted key names unchanged", () => {
    // The five legacy keys are pinned verbatim so they never drift;
    // scanResume is the added temporary resume key (sessionStorage at
    // the call site) and is pinned here so its spelling stays shared.
    assert.deepEqual(STORAGE_KEYS, {
      settings: "TempAsfStm.ASF.STM.Settings",
      blacklist: "TempAsfStm.ASF.STM.Blacklist",
      params: "TempAsfStm.ASF.STM.Params",
      botCache: "TempAsfStm.ASF.STM.BotCache",
      badgeCards: "TempAsfStm.ASF.STM.BadgeCards",
      scanResume: "TempAsfStm.ASF.STM.ScanResume",
    });
  });
});

describe("readJson / writeJson round-trip", () => {
  it("writes then reads back the same value", () => {
    const storage = fakeStorage();
    const value = { inventoryScan: true, scanFilters: [{ appId: 440, active: true }] };
    writeJson(storage, STORAGE_KEYS.settings, value);
    assert.deepEqual(readJson(storage, STORAGE_KEYS.settings, null), value);
  });

  it("stores JSON text (not a live reference)", () => {
    const storage = fakeStorage();
    const value = { nested: { list: [1, 2] } };
    writeJson(storage, STORAGE_KEYS.params, value);
    assert.equal(storage.dump()[STORAGE_KEYS.params], JSON.stringify(value));
  });

  it("round-trips primitives and null-valued containers", () => {
    const storage = fakeStorage();
    writeJson(storage, "k-number", 0);
    writeJson(storage, "k-string", "");
    writeJson(storage, "k-bool", false);
    assert.equal(readJson(storage, "k-number", 99), 0);
    assert.equal(readJson(storage, "k-string", "fallback"), "");
    assert.equal(readJson(storage, "k-bool", true), false);
  });
});

describe("readJson fallbacks", () => {
  it("returns the fallback for a missing key", () => {
    const storage = fakeStorage();
    assert.deepEqual(readJson(storage, STORAGE_KEYS.settings, { ok: true }), { ok: true });
  });

  it("returns the fallback for corrupt JSON", () => {
    const storage = fakeStorage({ [STORAGE_KEYS.settings]: "{not json" });
    assert.deepEqual(readJson(storage, STORAGE_KEYS.settings, { ok: true }), { ok: true });
  });

  it("treats a stored JSON null as absent", () => {
    const storage = fakeStorage({ [STORAGE_KEYS.blacklist]: "null" });
    assert.deepEqual(readJson(storage, STORAGE_KEYS.blacklist, []), []);
  });

  it("does not mutate the fallback object across calls", () => {
    const storage = fakeStorage();
    const fallback: string[] = [];
    const first = readJson(storage, STORAGE_KEYS.blacklist, fallback);
    assert.equal(first, fallback, "the fallback instance is returned as-is");
    first.push("123");
    assert.deepEqual(fallback, ["123"]);
  });
});

describe("removeKey", () => {
  it("deletes the value so reads fall back again", () => {
    const storage = fakeStorage();
    writeJson(storage, STORAGE_KEYS.botCache, { Result: [] });
    assert.deepEqual(readJson(storage, STORAGE_KEYS.botCache, "fallback"), { Result: [] });
    removeKey(storage, STORAGE_KEYS.botCache);
    assert.equal(readJson(storage, STORAGE_KEYS.botCache, "fallback"), "fallback");
    assert.equal(STORAGE_KEYS.botCache in storage.dump(), false);
  });

  it("is a no-op for a key that was never written", () => {
    const storage = fakeStorage();
    removeKey(storage, "missing");
    assert.deepEqual(storage.dump(), {});
  });
});
