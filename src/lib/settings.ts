// Shared settings helpers for ASF-STM-Enhancement.
//
// Single source of truth: vitest imports this module directly, and the build
// script compiles it and inlines the output into the userscript
// (SETTINGS_LIB slot) so the distributed userscripts stay single-file.

/** One entry of the persisted scan-filter list. */
export interface ScanFilterEntry {
  appId: number | string;
  title?: unknown;
  active?: unknown;
}

/** Which scan path a run must take. */
export interface ScanPlan {
  mode: "filters" | "inventory" | "badge";
  inventoryScan: boolean;
  useScanFilters: boolean;
  activeFilterAppIds: Array<number | string>;
}

function cloneSettingValue(value: unknown): unknown {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Merges persisted settings over the defaults: stored values win (including
// explicit false/0), missing keys receive a fresh copy of their default, and
// unknown stored keys are preserved. A missing or corrupt stored object yields
// the defaults, so a stored `inventoryScan: true` is never clobbered.
export function mergeWithDefaults(stored: unknown, defaults: Record<string, unknown>): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  for (const key of Object.keys(defaults)) {
    merged[key] = cloneSettingValue(defaults[key]);
  }
  if (isRecord(stored)) {
    for (const key of Object.keys(stored)) {
      if (stored[key] !== undefined) {
        merged[key] = stored[key];
      }
    }
  }
  return merged;
}

export function getActiveScanFilters(settings: unknown): ScanFilterEntry[] {
  if (!isRecord(settings) || !Array.isArray(settings.scanFilters)) {
    return [];
  }
  return settings.scanFilters.filter((filter): filter is ScanFilterEntry => isRecord(filter) && Boolean(filter.active));
}

// Resolves which scan path a run must take from the settings snapshot captured
// when Scan was clicked. Scan filters take precedence by design; otherwise the
// persisted `inventoryScan` flag decides between the inventory scan and the
// badge-page scan, so the executed path always matches the saved setting.
export function resolveScanPlan(settings: unknown): ScanPlan {
  const activeFilters = getActiveScanFilters(settings);
  const record = isRecord(settings) ? settings : null;
  if (record && Boolean(record.useScanFilters) && activeFilters.length > 0) {
    return {
      mode: "filters",
      inventoryScan: Boolean(record.inventoryScan),
      useScanFilters: true,
      activeFilterAppIds: activeFilters.map((filter) => filter.appId),
    };
  }
  if (record && Boolean(record.inventoryScan)) {
    return {
      mode: "inventory",
      inventoryScan: true,
      useScanFilters: false,
      activeFilterAppIds: [],
    };
  }
  return {
    mode: "badge",
    inventoryScan: false,
    useScanFilters: false,
    activeFilterAppIds: [],
  };
}

/** Prerequisites for completing an inventory-mode scan. */
export interface InventoryHealth {
  inventoryOk: boolean;
  badgesDbOk: boolean;
  tradabilityOk: boolean;
}

/** Where a scan run must go next: inventory discovery, badge pages, or abort. */
export type ScanRoute = "inventory" | "badges" | "abort";

// Decides the next path from the snapshotted plan plus inventory health.
// Inventory mode proceeds only when every prerequisite holds; any failure
// aborts instead of silently falling back to badge pages. Non-inventory
// modes keep the badge-page path (filters mode is diverted earlier by
// processFilters, badges mode is the explicit badge flow).
export function resolveScanRoute(plan: ScanPlan, health: InventoryHealth): ScanRoute {
  if (plan.mode !== "inventory") {
    return "badges";
  }
  return health.inventoryOk && health.badgesDbOk && health.tradabilityOk ? "inventory" : "abort";
}
