// Shared settings helpers for ASF-STM-Enhancement.
//
// Single source of truth: vitest imports this module directly, and the lib is
// bundled into the single-file userscript via the normal rolldown import.

import { z } from "zod/mini";

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

// Declared shape of the persisted settings. Fields are permissive here: the
// envelope parse only establishes "this is a settings object", while type
// strictness is enforced per key by `validateAgainstDefault` so one bad field
// never discards the user's other stored values.
const settingsSchema = z.looseObject({
  matchFriends: z.optional(z.unknown()),
  inventoryScan: z.optional(z.unknown()),
  inventoryScanDelay: z.optional(z.unknown()),
  anyBots: z.optional(z.unknown()),
  fairBots: z.optional(z.unknown()),
  sortByName: z.optional(z.unknown()),
  sortBotsBy: z.optional(z.unknown()),
  botMinItems: z.optional(z.unknown()),
  botMaxItems: z.optional(z.unknown()),
  weblimiter: z.optional(z.unknown()),
  errorLimiter: z.optional(z.unknown()),
  debug: z.optional(z.unknown()),
  maxErrors: z.optional(z.unknown()),
  filterBackgroundColor: z.optional(z.unknown()),
  preventClose: z.optional(z.unknown()),
  tradeMessage: z.optional(z.unknown()),
  autoSend: z.optional(z.unknown()),
  doAfterTrade: z.optional(z.unknown()),
  order: z.optional(z.unknown()),
  useScanFilters: z.optional(z.unknown()),
  scanFilters: z.optional(z.unknown()),
  autoAddScanFilters: z.optional(z.unknown()),
  autoDeleteScanFilters: z.optional(z.unknown()),
});

/** Keys this settings schema knows about, for drop-unknown diagnostics. */
export type SettingsKey = keyof z.infer<typeof settingsSchema>;

// Validates one stored value against its default's kind. Wrong-typed values
// fall back to the default for that key while other stored keys survive, so a
// corrupt field never discards the rest of the user's configuration. Unknown
// keys and explicitly falsy values are preserved exactly as before.
function validateAgainstDefault(value: unknown, fallback: unknown): unknown {
  if (value === undefined) {
    return fallback;
  }
  if (typeof fallback === "boolean") {
    return typeof value === "boolean" ? value : fallback;
  }
  if (typeof fallback === "number") {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  }
  if (typeof fallback === "string") {
    return typeof value === "string" ? value : fallback;
  }
  if (Array.isArray(fallback)) {
    return Array.isArray(value) ? value : fallback;
  }
  return value;
}

// Merges persisted settings over the defaults: stored values win (including
// explicit false/0), missing keys receive a fresh copy of their default, and
// unknown stored keys are preserved. A wrong-typed stored value falls back to
// its default per key. A missing or corrupt stored object yields the defaults,
// so a stored `inventoryScan: true` is never clobbered.
export function mergeWithDefaults(stored: unknown, defaults: Record<string, unknown>): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  for (const key of Object.keys(defaults)) {
    merged[key] = cloneSettingValue(defaults[key]);
  }
  const parsed = settingsSchema.safeParse(stored);
  if (parsed.success) {
    const values = parsed.data as Record<string, unknown>;
    for (const key of Object.keys(values)) {
      if (values[key] !== undefined) {
        merged[key] = validateAgainstDefault(values[key], merged[key]);
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
