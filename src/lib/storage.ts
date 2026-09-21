// Generic JSON persistence primitive.
//
// No DOM or settings knowledge: callers pass a `StorageLike` (the userscript
// passes real `localStorage`, tests pass an in-memory fake) and get safe
// read/write/remove with fallbacks. Domain-specific load/save semantics stay
// with their owning modules; key names are declared here so every consumer
// shares one spelling.

/** The minimal storage surface this module needs. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Persisted key names, unchanged from the pre-extraction userscript. */
export const STORAGE_KEYS = {
  settings: "TempAsfStm.ASF.STM.Settings",
  blacklist: "TempAsfStm.ASF.STM.Blacklist",
  params: "TempAsfStm.ASF.STM.Params",
  botCache: "TempAsfStm.ASF.STM.BotCache",
  badgeCards: "TempAsfStm.ASF.STM.BadgeCards",
} as const;

/** One of the declared persisted keys. */
export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

/**
 * Reads and parses a JSON value, returning `fallback` when the key is absent
 * or the stored text is not parseable. Parse failures never throw.
 */
export function readJson<T>(storage: StorageLike, key: string, fallback: T): T {
  const raw = storage.getItem(key);
  if (raw === null) {
    return fallback;
  }
  try {
    const parsed = JSON.parse(raw) as T;
    return parsed === null ? fallback : parsed;
  } catch {
    return fallback;
  }
}

/** Serializes and stores a value. Throws only if the storage itself throws. */
export function writeJson(storage: StorageLike, key: string, value: unknown): void {
  storage.setItem(key, JSON.stringify(value));
}

/** Removes a key so subsequent reads fall back to their default. */
export function removeKey(storage: StorageLike, key: string): void {
  storage.removeItem(key);
}
