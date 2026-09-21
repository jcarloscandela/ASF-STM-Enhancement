// Unit tests for the validated scanner-config merge (src/lib/settings.ts).
//
// Run with exactly one command from the repo root:
//
//   pnpm test
//
// Focused on the upgrade/survival guarantees from the `scanner-config` spec:
// stored values win, missing keys backfill, corrupt storage falls back, and a
// wrong-typed value falls back per key without discarding the rest.

import { describe, it } from "vitest";
import assert from "node:assert/strict";

import {
  getActiveScanFilters,
  mergeWithDefaults,
  resolveScanPlan,
  resolveScanRoute,
  type ScanFilterEntry,
} from "../src/lib/settings";

/** The real defaults shape (mirrors defaultSettings in the userscript). */
interface Config extends Record<string, unknown> {
  matchFriends: boolean;
  inventoryScan: boolean;
  inventoryScanDelay: number;
  anyBots: boolean;
  fairBots: boolean;
  sortByName: boolean;
  sortBotsBy: string[];
  botMinItems: number;
  botMaxItems: number;
  weblimiter: number;
  errorLimiter: number;
  debug: boolean;
  maxErrors: number;
  filterBackgroundColor: string;
  preventClose: boolean;
  tradeMessage: string;
  autoSend: boolean;
  doAfterTrade: string;
  order: string;
  useScanFilters: boolean;
  scanFilters: ScanFilterEntry[];
  autoAddScanFilters: boolean;
  autoDeleteScanFilters: boolean;
}

function realDefaults(): Config {
  return {
    matchFriends: false,
    inventoryScan: false,
    inventoryScanDelay: 3000,
    anyBots: true,
    fairBots: true,
    sortByName: true,
    sortBotsBy: [
      "MatchEverythingFirst",
      "TotalGamesCountDesc",
      "TotalItemsCountDesc",
      "TotalInventoryCountAsc",
      "None",
    ],
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
}

describe("mergeWithDefaults (scanner config)", () => {
  it("keeps a stored inventoryScan:true across reload", () => {
    const merged = mergeWithDefaults({ inventoryScan: true }, realDefaults()) as Config;
    assert.equal(merged.inventoryScan, true);
    assert.equal(merged.weblimiter, 300, "untouched keys keep their defaults");
  });

  it("backfills keys missing from an older stored config without clobbering", () => {
    const stored = { inventoryScan: true, tradeMessage: "custom" };
    const merged = mergeWithDefaults(stored, realDefaults()) as Config;
    assert.equal(merged.tradeMessage, "custom");
    assert.equal(merged.inventoryScanDelay, 3000, "new key gets its default");
    assert.equal(merged.autoDeleteScanFilters, true, "new key gets its default");
  });

  it("falls back to defaults for corrupt or missing storage", () => {
    for (const stored of [null, undefined, "corrupt", 42, [], "{}"]) {
      const merged = mergeWithDefaults(stored, realDefaults());
      assert.deepEqual(merged, realDefaults(), `stored=${JSON.stringify(stored)}`);
    }
  });

  it("falls back per key on a wrong-typed value while preserving the rest", () => {
    const stored = {
      inventoryScan: "yes",
      weblimiter: "fast",
      tradeMessage: "keep me",
      matchFriends: true,
    };
    const merged = mergeWithDefaults(stored, realDefaults()) as Config;
    assert.equal(merged.inventoryScan, false, "string where boolean expected falls back");
    assert.equal(merged.weblimiter, 300, "string where number expected falls back");
    assert.equal(merged.tradeMessage, "keep me", "valid stored value survives");
    assert.equal(merged.matchFriends, true, "valid stored value survives");
  });

  it("preserves array-valued stored settings and unknown keys", () => {
    const stored = {
      sortBotsBy: ["None"],
      scanFilters: [{ appId: 440, title: "TF2", active: true }],
      futureFlag: "kept",
    };
    const merged = mergeWithDefaults(stored, realDefaults()) as Config;
    assert.deepEqual(merged.sortBotsBy, ["None"]);
    assert.deepEqual(merged.scanFilters, [{ appId: 440, title: "TF2", active: true }]);
    assert.equal(merged["futureFlag"], "kept");
  });

  it("does not alias defaults into the merge result", () => {
    const defaults = realDefaults();
    const merged = mergeWithDefaults(null, defaults) as Config;
    merged.scanFilters.push({ appId: 1 });
    merged.sortBotsBy.push("None");
    assert.deepEqual(defaults.scanFilters, []);
    assert.equal(defaults.sortBotsBy.length, 5);
  });
});

describe("resolveScanPlan precedence (scanner config)", () => {
  const withFilters = (overrides: Record<string, unknown>) => ({
    inventoryScan: true,
    useScanFilters: true,
    scanFilters: [{ appId: 440, active: true }],
    ...overrides,
  });

  it("gives active scan filters precedence over the inventory scan", () => {
    assert.equal(resolveScanPlan(withFilters({})).mode, "filters");
  });

  it("selects the inventory scan when filters are off", () => {
    assert.equal(resolveScanPlan(withFilters({ useScanFilters: false })).mode, "inventory");
  });

  it("selects the inventory scan when filters are on but all inactive", () => {
    const plan = resolveScanPlan(withFilters({ scanFilters: [{ appId: 440, active: false }] }));
    assert.equal(plan.mode, "inventory");
    assert.deepEqual(getActiveScanFilters({ scanFilters: [{ appId: 440, active: false }] }), []);
  });

  it("defaults to the badge-page scan when both are off", () => {
    assert.equal(resolveScanPlan(withFilters({ inventoryScan: false, useScanFilters: false })).mode, "badge");
  });

  it("routes a healthy inventory plan to inventory and never to badge pages", () => {
    const plan = resolveScanPlan(withFilters({ useScanFilters: false }));
    assert.equal(resolveScanRoute(plan, { inventoryOk: true, badgesDbOk: true, tradabilityOk: true }), "inventory");
    assert.equal(resolveScanRoute(plan, { inventoryOk: false, badgesDbOk: true, tradabilityOk: true }), "abort");
  });
});
