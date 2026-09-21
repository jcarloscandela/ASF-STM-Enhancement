// Unit tests for the settings helpers (src/lib/settings.ts).
//
// Run with exactly one command from the repo root:
//
//   pnpm test
//
// Uses plain settings-shaped fixtures. `describe`/`it` come from
// vitest, assertions from node:assert/strict.

import { describe, it } from "vitest";
import assert from "node:assert/strict";

import {
  getActiveScanFilters,
  loadSettings,
  mergeWithDefaults,
  resetSettings,
  resolveScanPlan,
  resolveScanRoute,
  saveSettings,
  SETTINGS_STORAGE_KEY,
  type InventoryHealth,
  type ScanFilterEntry,
  type ScanPlan,
} from "../src/lib/settings";
import type { StorageLike } from "../src/lib/storage";
import { STORAGE_KEYS } from "../src/lib/storage";

interface TestDefaults extends Record<string, unknown> {
  inventoryScanDelay: number;
  useScanFilters: boolean;
  scanFilters: ScanFilterEntry[];
  sortBotsBy: string[];
}

function baseDefaults(): TestDefaults {
  return {
    inventoryScanDelay: 3000,
    useScanFilters: false,
    scanFilters: [],
    sortBotsBy: ["MatchEverythingFirst"],
  };
}

describe("mergeWithDefaults", () => {
  it("preserves a stored legacy inventoryScan:true and fills missing keys with defaults", () => {
    const stored = { inventoryScan: true };
    const merged = mergeWithDefaults(stored, baseDefaults()) as TestDefaults;
    assert.equal(merged["inventoryScan"], true);
    assert.equal(merged.inventoryScanDelay, 3000);
    assert.equal(merged.useScanFilters, false);
    assert.deepEqual(merged.scanFilters, []);
  });

  it("returns fresh defaults when nothing usable was stored", () => {
    for (const stored of [null, undefined, "corrupt", 42, []]) {
      const merged = mergeWithDefaults(stored, baseDefaults());
      assert.deepEqual(merged, baseDefaults(), `stored=${JSON.stringify(stored)}`);
    }
  });

  it("keeps explicit falsy stored values instead of overwriting them", () => {
    const stored = { inventoryScan: false, inventoryScanDelay: 0 };
    const merged = mergeWithDefaults(stored, baseDefaults()) as TestDefaults;
    assert.equal(merged["inventoryScan"], false);
    assert.equal(merged.inventoryScanDelay, 0);
  });

  it("does not alias the defaults object", () => {
    const defaults = baseDefaults();
    const merged = mergeWithDefaults(null, defaults) as TestDefaults;
    merged.scanFilters.push({ appId: 1 });
    merged.sortBotsBy.push("None");
    assert.deepEqual(defaults.scanFilters, []);
    assert.deepEqual(defaults.sortBotsBy, ["MatchEverythingFirst"]);
  });

  it("preserves unknown stored keys", () => {
    const merged = mergeWithDefaults({ futureFlag: 1 }, baseDefaults());
    assert.equal(merged["futureFlag"], 1);
  });
});

describe("resolveScanPlan", () => {
  it("ignores a legacy stored inventoryScan flag: filters off always means inventory", () => {
    for (const stored of [
      { inventoryScan: true, useScanFilters: false, scanFilters: [] },
      { inventoryScan: false, useScanFilters: false, scanFilters: [] },
    ]) {
      const plan = resolveScanPlan(stored);
      assert.equal(plan.mode, "inventory");
      assert.equal("inventoryScan" in plan, false);
    }
  });

  it("gives active scan filters precedence over the inventory scan", () => {
    const plan = resolveScanPlan({
      useScanFilters: true,
      scanFilters: [{ appId: 730, title: "Game", active: true }],
    });
    assert.equal(plan.mode, "filters");
    assert.deepEqual(plan.activeFilterAppIds, [730]);
  });

  it("ignores inactive scan filters", () => {
    const plan = resolveScanPlan({
      useScanFilters: true,
      scanFilters: [{ appId: 730, title: "Game", active: false }],
    });
    assert.equal(plan.mode, "inventory");
  });

  it("resolves to the inventory scan for missing settings", () => {
    assert.equal(resolveScanPlan(null).mode, "inventory");
    assert.equal(resolveScanPlan({}).mode, "inventory");
  });
});

describe("getActiveScanFilters", () => {
  it("returns only active filters and tolerates bad shapes", () => {
    const settings = {
      scanFilters: [{ appId: 1, active: true }, { appId: 2, active: false }, null],
    };
    assert.deepEqual(getActiveScanFilters(settings), [{ appId: 1, active: true }]);
    assert.deepEqual(getActiveScanFilters(null), []);
    assert.deepEqual(getActiveScanFilters({}), []);
  });
});

describe("resolveScanRoute", () => {
  const inventoryPlan: ScanPlan = { mode: "inventory", useScanFilters: false, activeFilterAppIds: [] };
  const filtersPlan: ScanPlan = { mode: "filters", useScanFilters: true, activeFilterAppIds: [440] };
  const healthy: InventoryHealth = { inventoryOk: true, badgesDbOk: true, tradabilityOk: true };

  it("proceeds with inventory discovery when inventory mode is fully healthy", () => {
    assert.equal(resolveScanRoute(inventoryPlan, healthy), "inventory");
  });

  it("never routes inventory mode to badge pages, aborting on any failed prerequisite", () => {
    for (let mask = 0; mask < 8; mask++) {
      const health: InventoryHealth = {
        inventoryOk: Boolean(mask & 1),
        badgesDbOk: Boolean(mask & 2),
        tradabilityOk: Boolean(mask & 4),
      };
      const route = resolveScanRoute(inventoryPlan, health);
      assert.ok(route !== "badges", `health=${JSON.stringify(health)} routed to badges`);
      assert.equal(route, mask === 7 ? "inventory" : "abort", `health=${JSON.stringify(health)}`);
    }
  });

  it("keeps filters mode off the inventory-routing decision", () => {
    assert.equal(resolveScanRoute(filtersPlan, healthy), "badges");
    assert.equal(
      resolveScanRoute(filtersPlan, { inventoryOk: false, badgesDbOk: false, tradabilityOk: false }),
      "badges",
    );
  });
});

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

const storeDefaults: Record<string, unknown> = {
  matchFriends: false,
  inventoryScanDelay: 3000,
  anyBots: true,
  fairBots: true,
  sortByName: true,
  sortBotsBy: ["MatchEverythingFirst"],
  botMinItems: 0,
  botMaxItems: 0,
  weblimiter: 300,
  errorLimiter: 30000,
  debug: false,
  maxErrors: 3,
  filterBackgroundColor: "rgba(23,26,33,0.8)",
  preventClose: true,
  tradeMessage: "ASF STM Matcher",
  autoSend: false,
  doAfterTrade: "NOTHING",
  order: "AS_IS",
  useScanFilters: false,
  scanFilters: [],
  autoAddScanFilters: true,
  autoDeleteScanFilters: true,
};

describe("settings store round-trips", () => {
  it("a legacy stored inventoryScan flag is preserved in storage but ignored for dispatch", () => {
    const storage = fakeStorage();
    const saved = mergeWithDefaults({ inventoryScan: true }, storeDefaults);
    saveSettings(storage, saved);
    const loaded = loadSettings(storage, storeDefaults);
    assert.equal(loaded["inventoryScan"], true, "legacy key is kept, never rewritten");
    assert.equal(resolveScanPlan(loaded).mode, "inventory");
  });

  it("an explicitly stored legacy false is preserved verbatim and dispatch runs the inventory path", () => {
    const storage = fakeStorage();
    saveSettings(storage, mergeWithDefaults({ inventoryScan: false }, storeDefaults));
    const loaded = loadSettings(storage, storeDefaults);
    assert.equal(loaded["inventoryScan"], false);
    assert.equal(resolveScanPlan(loaded).mode, "inventory");
  });

  it("a stored legacy key survives a defaults change without being rewritten", () => {
    const storage = fakeStorage();
    saveSettings(storage, mergeWithDefaults({ inventoryScan: false }, storeDefaults));
    const changedDefaults = { ...storeDefaults, inventoryScan: true };
    const loaded = loadSettings(storage, changedDefaults);
    assert.equal(loaded["inventoryScan"], false, "stored legacy value must not be overwritten by defaults");
  });

  it("missing or corrupt storage loads a fresh defaults copy", () => {
    for (const seed of [
      {},
      { [SETTINGS_STORAGE_KEY]: "not json" } as Record<string, string>,
      { [SETTINGS_STORAGE_KEY]: "null" } as Record<string, string>,
    ]) {
      const storage = fakeStorage(seed);
      const loaded = loadSettings(storage, storeDefaults);
      assert.deepEqual(loaded, storeDefaults, `seed=${JSON.stringify(seed)}`);
      assert.equal(resolveScanPlan(loaded).mode, "inventory", `seed=${JSON.stringify(seed)}`);
    }
  });

  it("reset removes all four persisted keys and restores defaults", () => {
    const storage = fakeStorage({
      [SETTINGS_STORAGE_KEY]: JSON.stringify({ inventoryScan: true }),
      [STORAGE_KEYS.blacklist]: JSON.stringify(["123"]),
      [STORAGE_KEYS.params]: JSON.stringify({ filter: [1] }),
      [STORAGE_KEYS.botCache]: JSON.stringify({ Result: [] }),
    });
    const defaults = resetSettings(storage, storeDefaults);
    const dump = storage.dump();
    assert.equal(Object.keys(dump).length, 0, `all keys cleared, got ${JSON.stringify(Object.keys(dump))}`);
    assert.deepEqual(defaults, storeDefaults);
    assert.equal("inventoryScan" in defaults, false);
  });

  it("reset state persists: a reload after reset still yields defaults and inventory dispatch", () => {
    const storage = fakeStorage({
      [SETTINGS_STORAGE_KEY]: JSON.stringify({ inventoryScan: true }),
      [STORAGE_KEYS.blacklist]: JSON.stringify(["123"]),
      [STORAGE_KEYS.params]: JSON.stringify({ filter: [1] }),
      [STORAGE_KEYS.botCache]: JSON.stringify({ Result: [] }),
    });
    resetSettings(storage, storeDefaults);
    const reloaded = loadSettings(storage, storeDefaults);
    assert.equal("inventoryScan" in reloaded, false);
    assert.equal(resolveScanPlan(reloaded).mode, "inventory");
  });

  it("the dialog-save handler order (mutate settings then save) round-trips", () => {
    const storage = fakeStorage();
    // mirrors ShowConfigDialog: apply dialog values, then SaveConfig()
    const applied = mergeWithDefaults({ matchFriends: true }, storeDefaults);
    saveSettings(storage, applied);
    const loaded = loadSettings(storage, storeDefaults);
    assert.equal(loaded.matchFriends, true);
    assert.equal(resolveScanPlan(loaded).mode, "inventory");
  });

  it("uses the versioned key, not the legacy unversioned one", () => {
    const storage = fakeStorage({
      // legacy pre-versioned key with inventoryScan=true must be ignored
      [STORAGE_KEYS.settings]: JSON.stringify({ inventoryScan: true }),
    });
    const loaded = loadSettings(storage, storeDefaults);
    assert.equal("inventoryScan" in loaded, false, "legacy key is not read by the versioned store");
    assert.ok(SETTINGS_STORAGE_KEY.startsWith(STORAGE_KEYS.settings + ".v"), SETTINGS_STORAGE_KEY);
  });
});
