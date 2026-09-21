// Shared settings helpers for ASF-STM-Enhancement.
//
// Single source of truth: vitest imports this module directly, and the lib is
// bundled into the single-file userscript via the normal rolldown import.

import { z } from "zod/mini";

import type { ScanFilterEntry } from "./models";

export type { ScanFilterEntry };

/** Which scan path a run must take. */
export interface ScanPlan {
  mode: "filters" | "inventory";
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
// unknown stored keys are preserved (a legacy `inventoryScan` value therefore
// survives in storage but is never read). A wrong-typed stored value falls
// back to its default per key. A missing or corrupt stored object yields the
// defaults, so a partially corrupt store never discards the user's
// configuration.
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
// inventory scan is the unconditional default, so the executed path never
// depends on a persisted flag.
export function resolveScanPlan(settings: unknown): ScanPlan {
  const activeFilters = getActiveScanFilters(settings);
  const record = isRecord(settings) ? settings : null;
  if (record && Boolean(record.useScanFilters) && activeFilters.length > 0) {
    return {
      mode: "filters",
      useScanFilters: true,
      activeFilterAppIds: activeFilters.map((filter) => filter.appId),
    };
  }
  return {
    mode: "inventory",
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
// aborts instead of silently degrading. Filters mode is diverted earlier by
// processFilters, so its route value is never consulted by the scan flow.
export function resolveScanRoute(plan: ScanPlan, health: InventoryHealth): ScanRoute {
  if (plan.mode !== "inventory") {
    return "badges";
  }
  return health.inventoryOk && health.badgesDbOk && health.tradabilityOk ? "inventory" : "abort";
}

// ---------------------------------------------------------------------------
// Settings store
// ---------------------------------------------------------------------------

import type { StorageLike } from "./storage";
import { STORAGE_KEYS, readJson, removeKey, writeJson } from "./storage";

/**
 * Versioned settings-store key: the version lives in the key name so a future
 * format change can migrate (or ignore) older data without ambiguity.
 */
export const SETTINGS_STORAGE_KEY = "TempAsfStm.ASF.STM.Settings.v1";

/**
 * Loads the persisted settings and merges them over `defaults`:
 * stored values win (including explicit `false`/`0`), missing keys backfill,
 * wrong-typed values fall back per key, and missing/corrupt storage yields a
 * fresh copy of the defaults. Never throws on unreadable or corrupt data.
 */
export function loadSettings(storage: StorageLike, defaults: Record<string, unknown>): Record<string, unknown> {
  const stored = readJson<unknown>(storage, SETTINGS_STORAGE_KEY, null);
  return mergeWithDefaults(stored, defaults);
}

/** Persists the settings object atomically as one JSON document. */
export function saveSettings(storage: StorageLike, settings: unknown): void {
  writeJson(storage, SETTINGS_STORAGE_KEY, settings);
}

/**
 * Clears every persisted value (settings, blacklist, params, bot cache) and
 * returns a fresh copy of the defaults, so the caller can restore its
 * in-memory state in one step. BREAKING vs earlier behavior: the blacklist no
 * longer survives reset.
 */
export function resetSettings(storage: StorageLike, defaults: Record<string, unknown>): Record<string, unknown> {
  removeKey(storage, SETTINGS_STORAGE_KEY);
  removeKey(storage, STORAGE_KEYS.blacklist);
  removeKey(storage, STORAGE_KEYS.params);
  removeKey(storage, STORAGE_KEYS.botCache);
  return mergeWithDefaults(null, defaults);
}
