// Unit tests for the scan resume record (src/lib/scan-resume.ts).
//
// Run with exactly one command from the repo root:
//
//   pnpm test
//
// Pure fixture tests over an in-memory StorageLike: round-trip, version /
// plan validation, corrupt-data and quota safety, and clearing - the
// contract behind the interrupted badge-detail phase resume (openspec change
// fix-badge-detail-phase-completion).

import { describe, it } from "vitest";
import assert from "node:assert/strict";

import {
  SCAN_RESUME_VERSION,
  buildScanResumeRecord,
  clearScanResume,
  readScanResume,
  writeScanResume,
  type ScanResumeRecord,
} from "../src/lib/scan-resume";
import { STORAGE_KEYS, type StorageLike } from "../src/lib/storage";
import type { MatchBadge } from "../src/lib/matcher-core";
import type { InventoryCardCounts } from "../src/lib/tradable";

function fakeStorage(seed: Record<string, string> = {}): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>(Object.entries(seed));
  return {
    map,
    getItem: (key) => (map.has(key) ? (map.get(key) as string) : null),
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

const badge = (appId: number): MatchBadge => ({
  appId,
  title: `Game ${appId}`,
  maxCards: 5,
  maxSets: 1,
  lastSet: 2,
  cards: [
    { item: "Card A", hash: `${appId}-a`, count: 2, iconUrl: "icon", number: 0 },
    { item: "Card B", hash: `${appId}-b`, count: 0, iconUrl: "icon", number: 1 },
  ],
});

const counts: InventoryCardCounts = {
  440: { "Game - Card A": { owned: 2, tradable: 2 } },
};

const PLAN = "filters:440,570";

function input(): Parameters<typeof buildScanResumeRecord>[0] {
  return {
    planKey: PLAN,
    myBadges: [badge(440), badge(570)],
    inventoryCardCounts: counts,
    pendingAppIds: [440, 570],
    pendingIndex: 1,
    badgesSteps: 2,
  };
}

/** Overwrites the stored raw value, bypassing the writer (for tamper tests). */
function tamper(storage: StorageLike, value: unknown): void {
  storage.setItem(STORAGE_KEYS.scanResume, JSON.stringify(value));
}

describe("scan-resume record", () => {
  it("round-trips a record through storage under the declared key", () => {
    const storage = fakeStorage();
    const record = buildScanResumeRecord(input());
    writeScanResume(storage, record);
    assert.ok(storage.map.has(STORAGE_KEYS.scanResume), "stored under the shared key");
    const read = readScanResume(storage, PLAN);
    assert.deepEqual(read, record);
  });

  it("stamps the current version on built records", () => {
    assert.equal(buildScanResumeRecord(input()).version, SCAN_RESUME_VERSION);
  });

  it("returns undefined for a missing key", () => {
    assert.equal(readScanResume(fakeStorage(), PLAN), undefined);
  });

  it("returns undefined for corrupt JSON", () => {
    const storage = fakeStorage();
    storage.setItem(STORAGE_KEYS.scanResume, "{not json");
    assert.equal(readScanResume(storage, PLAN), undefined);
  });

  it("returns undefined on a version mismatch", () => {
    const storage = fakeStorage();
    tamper(storage, { ...buildScanResumeRecord(input()), version: SCAN_RESUME_VERSION + 1 });
    assert.equal(readScanResume(storage, PLAN), undefined);
  });

  it("returns undefined on a planKey mismatch", () => {
    const storage = fakeStorage();
    writeScanResume(storage, buildScanResumeRecord(input()));
    assert.equal(readScanResume(storage, "filters:753"), undefined);
  });

  it("returns undefined when fields have the wrong shape", () => {
    const storage = fakeStorage();
    const record = buildScanResumeRecord(input());

    tamper(storage, { ...record, pendingAppIds: "nope" });
    assert.equal(readScanResume(storage, PLAN), undefined, "pendingAppIds must be an array");

    tamper(storage, { ...record, pendingIndex: record.pendingAppIds.length + 1 });
    assert.equal(readScanResume(storage, PLAN), undefined, "pendingIndex must stay within the queue");

    tamper(storage, { ...record, pendingIndex: -1 });
    assert.equal(readScanResume(storage, PLAN), undefined, "pendingIndex must not be negative");

    tamper(storage, { ...record, myBadges: {} });
    assert.equal(readScanResume(storage, PLAN), undefined, "myBadges must be an array");

    tamper(storage, { ...record, inventoryCardCounts: 7 });
    assert.equal(readScanResume(storage, PLAN), undefined, "inventoryCardCounts must be an object");

    tamper(storage, { ...record, badgesSteps: "2" });
    assert.equal(readScanResume(storage, PLAN), undefined, "badgesSteps must be a number");

    tamper(storage, { ...record, planKey: 42 });
    // planKey shape is checked by equality against the expected plan anyway;
    // a non-string planKey can never equal the string plan.
    assert.equal(readScanResume(storage, PLAN), undefined);
  });

  it("degrades silently when storage rejects writes", () => {
    const storage = fakeStorage();
    const throwing: StorageLike = {
      getItem: storage.getItem,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: storage.removeItem,
    };
    assert.doesNotThrow(() => writeScanResume(throwing, buildScanResumeRecord(input())));
    assert.equal(readScanResume(storage, PLAN), undefined, "nothing was persisted");
  });

  it("returns undefined when storage rejects reads", () => {
    const blocked: StorageLike = {
      getItem: () => {
        throw new Error("SecurityError: storage disabled");
      },
      setItem: () => {},
      removeItem: () => {},
    };
    assert.equal(readScanResume(blocked, PLAN), undefined);
  });

  it("clear removes the record", () => {
    const storage = fakeStorage();
    writeScanResume(storage, buildScanResumeRecord(input()));
    clearScanResume(storage);
    assert.ok(!storage.map.has(STORAGE_KEYS.scanResume));
    assert.equal(readScanResume(storage, PLAN), undefined);
  });

  it("clear never throws on empty storage", () => {
    assert.doesNotThrow(() => clearScanResume(fakeStorage()));
  });
});

// Type-level sanity: the record keeps the shapes the resume hook restores.
const _typeCheck: ScanResumeRecord = buildScanResumeRecord(input());
void _typeCheck;
