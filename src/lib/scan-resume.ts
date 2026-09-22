// Temporary scan-resume record for the badge-detail phase (openspec change
// fix-badge-detail-phase-completion).
//
// Pure persistence logic over an injectable StorageLike: the userscript
// passes sessionStorage - per-tab, so a resume offer can never come from a
// previous day - and tests pass an in-memory fake. Reads validate version,
// plan key, and field shapes and never throw (including when the storage
// itself rejects reads); writes swallow storage errors so a quota failure
// degrades to a fresh scan instead of breaking one. The record captures the
// outputs of the phases before the badge-detail queue (derived badges,
// inventory counts) plus the queue and its position, so a resumed scan
// continues Phase 2 without re-running them.

import type { InventoryCardCounts, MatchBadge } from "./models";
import { STORAGE_KEYS, readJson, removeKey, writeJson, type StorageLike } from "./storage";

/** Bumped whenever the record shape changes; a mismatch discards the record. */
export const SCAN_RESUME_VERSION = 1;

/** Everything the badge-detail phase persists for a later resume. */
export interface ScanResumeInput {
  /** Stable serialization of the resolved scan plan the record belongs to. */
  planKey: string;
  /** Own badges with their derived card state at save time. */
  myBadges: MatchBadge[];
  /** Inventory-derived owned/tradable counts pending fills still need. */
  inventoryCardCounts: InventoryCardCounts;
  /** App ids of the badges still awaiting a detail fetch, in queue order. */
  pendingAppIds: number[];
  /** Queue position: how many pending entries were completed. */
  pendingIndex: number;
  /** Badge progress total for the phase. */
  badgesSteps: number;
}

/** A stored record: input plus its validation version. */
export interface ScanResumeRecord extends ScanResumeInput {
  version: number;
}

/** Builds a record stamped with the current version. */
export function buildScanResumeRecord(input: ScanResumeInput): ScanResumeRecord {
  return { version: SCAN_RESUME_VERSION, ...input };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Reads and validates the stored record for `planKey`. Returns `undefined`
 * for a missing, corrupt, version-mismatched, plan-mismatched, or
 * wrong-shaped record, and when storage rejects reads - never throws.
 */
export function readScanResume(storage: StorageLike, planKey: string): ScanResumeRecord | undefined {
  let raw: unknown;
  try {
    raw = readJson<unknown>(storage, STORAGE_KEYS.scanResume, undefined);
  } catch {
    return undefined;
  }
  if (!isRecord(raw)) {
    return undefined;
  }
  if (raw.version !== SCAN_RESUME_VERSION || raw.planKey !== planKey) {
    return undefined;
  }
  if (!Array.isArray(raw.pendingAppIds) || !raw.pendingAppIds.every((id) => typeof id === "number")) {
    return undefined;
  }
  if (typeof raw.pendingIndex !== "number" || raw.pendingIndex < 0 || raw.pendingIndex > raw.pendingAppIds.length) {
    return undefined;
  }
  if (typeof raw.badgesSteps !== "number" || !Number.isFinite(raw.badgesSteps) || raw.badgesSteps < 0) {
    return undefined;
  }
  if (
    !Array.isArray(raw.myBadges) ||
    !raw.myBadges.every((badge) => isRecord(badge) && typeof badge.appId === "number" && Array.isArray(badge.cards))
  ) {
    return undefined;
  }
  if (!isRecord(raw.inventoryCardCounts)) {
    return undefined;
  }
  return raw as unknown as ScanResumeRecord;
}

/**
 * Persists a record, swallowing storage failures (quota, disabled storage)
 * so the scan degrades to a fresh run instead of throwing.
 */
export function writeScanResume(storage: StorageLike, record: ScanResumeRecord): void {
  try {
    writeJson(storage, STORAGE_KEYS.scanResume, record);
  } catch {
    // Degrade silently: no record means the next scan runs fresh.
  }
}

/** Removes the record; never throws. */
export function clearScanResume(storage: StorageLike): void {
  try {
    removeKey(storage, STORAGE_KEYS.scanResume);
  } catch {
    // Cleanup must never break the scan.
  }
}
