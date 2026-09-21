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

import { getActiveScanFilters, mergeWithDefaults, resolveScanPlan, type ScanFilterEntry } from "../src/lib/settings";

interface TestDefaults extends Record<string, unknown> {
  inventoryScan: boolean;
  inventoryScanDelay: number;
  useScanFilters: boolean;
  scanFilters: ScanFilterEntry[];
  sortBotsBy: string[];
}

function baseDefaults(): TestDefaults {
  return {
    inventoryScan: false,
    inventoryScanDelay: 3000,
    useScanFilters: false,
    scanFilters: [],
    sortBotsBy: ["MatchEverythingFirst"],
  };
}

describe("mergeWithDefaults", () => {
  it("preserves a stored inventoryScan:true and fills missing keys with defaults", () => {
    const stored = { inventoryScan: true };
    const merged = mergeWithDefaults(stored, baseDefaults()) as TestDefaults;
    assert.equal(merged.inventoryScan, true);
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
    assert.equal(merged.inventoryScan, false);
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
  it("selects the inventory scan when inventoryScan is saved as true", () => {
    const plan = resolveScanPlan({ inventoryScan: true, useScanFilters: false, scanFilters: [] });
    assert.equal(plan.mode, "inventory");
    assert.equal(plan.inventoryScan, true);
  });

  it("selects the badge-page scan when inventoryScan is saved as false", () => {
    const plan = resolveScanPlan({ inventoryScan: false, useScanFilters: false, scanFilters: [] });
    assert.equal(plan.mode, "badge");
  });

  it("gives active scan filters precedence over the inventory scan", () => {
    const plan = resolveScanPlan({
      inventoryScan: true,
      useScanFilters: true,
      scanFilters: [{ appId: 730, title: "Game", active: true }],
    });
    assert.equal(plan.mode, "filters");
    assert.deepEqual(plan.activeFilterAppIds, [730]);
  });

  it("ignores inactive scan filters", () => {
    const plan = resolveScanPlan({
      inventoryScan: true,
      useScanFilters: true,
      scanFilters: [{ appId: 730, title: "Game", active: false }],
    });
    assert.equal(plan.mode, "inventory");
  });

  it("falls back to the badge-page scan for missing settings", () => {
    assert.equal(resolveScanPlan(null).mode, "badge");
    assert.equal(resolveScanPlan({}).mode, "badge");
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
