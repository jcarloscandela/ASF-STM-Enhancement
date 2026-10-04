// @vitest-environment happy-dom
//
// Harness suite for the dataset-export wiring (src/lib/dataset-export.ts):
// button state transitions and the badge_cards.json download trigger against
// the real config-dialog markup. No network, no browser.
//
// Run with exactly one command from the repo root:
//
//   pnpm test

import { describe, it } from "vitest";
import assert from "node:assert/strict";

import {
  DATASET_EXPORT_FILENAME,
  newBadgeCardsCount,
  triggerDatasetExport,
  updateDatasetExportState,
} from "../src/lib/dataset-export";
import type { BadgeCardCache, BadgeDataset } from "../src/lib/dataset";
import { normalizeDataset } from "../src/lib/dataset";
import { renderConfigDialog, type ConfigDialogSettings } from "../src/templates/configDialogTemplate";

function settings(): ConfigDialogSettings {
  return {
    matchFriends: false,
    anyBots: true,
    fairBots: true,
    botMinItems: 0,
    botMaxItems: 0,
    sortByName: false,
    preventClose: false,
    debug: false,
    weblimiter: 1000,
    errorLimiter: 5000,
    maxErrors: 5,
    inventoryScanDelay: 300,
    tradeMessage: "hello",
    doAfterTrade: "NOTHING",
    order: "SORT",
    autoSend: false,
    useScanFilters: false,
    autoAddScanFilters: false,
    autoDeleteScanFilters: false,
  };
}

function dialogRoot(): HTMLElement {
  const template = document.createElement("template");
  template.innerHTML = renderConfigDialog(settings(), ["#171a21", 0.8], "https://example.test/q.png", "", "", "");
  return template.content.firstElementChild as HTMLElement;
}

function buttonIn(root: ParentNode): HTMLButtonElement {
  return root.querySelector("#downloadBadgeCardsButton") as HTMLButtonElement;
}

describe("dataset export dialog", () => {
  it("keeps the button disabled and downloads nothing on an empty diff", () => {
    const root = dialogRoot();
    const downloads: Array<[string, string]> = [];
    triggerDatasetExport(root, {}, {}, (filename, text) => {
      downloads.push([filename, text]);
    });
    assert.equal(buttonIn(root).disabled, true);
    assert.deepEqual(downloads, []);
  });

  it("enables the button and downloads the full archive once a game is learned", () => {
    const root = dialogRoot();
    const bundled: BadgeDataset = { 440: { size: 5, cards: [{ hash: "440-A" }] } };
    const cache: BadgeCardCache = {
      440: { size: 5, cards: [{ hash: "440-A" }] },
      753: { size: 5, name: "Learned", cards: [{ hash: "753-A", title: "Card A" }] },
    };
    assert.equal(newBadgeCardsCount(bundled, cache), 1);
    const downloads: Array<[string, string]> = [];
    triggerDatasetExport(root, bundled, cache, (filename, text) => {
      downloads.push([filename, text]);
    });
    assert.equal(buttonIn(root).disabled, false);
    assert.equal(downloads.length, 1);
    assert.equal(downloads[0]![0], DATASET_EXPORT_FILENAME);
    assert.deepEqual(Object.keys(JSON.parse(downloads[0]![1]) as Record<string, unknown>), ["440", "753"]);
  });

  it("upgrades a size-only bundled entry in the downloaded archive", () => {
    const root = dialogRoot();
    const bundled: BadgeDataset = { 570: { size: 6 } };
    const cache: BadgeCardCache = {
      570: { size: 6, name: "Learned Name", cards: [{ hash: "570-A", title: "Card A" }] },
    };
    const downloads: Array<[string, string]> = [];
    triggerDatasetExport(root, bundled, cache, (filename, text) => {
      downloads.push([filename, text]);
    });
    assert.equal(downloads.length, 1);
    const parsed = JSON.parse(downloads[0]![1]) as Record<string, { size: number; cards?: Array<{ hash: string }> }>;
    assert.deepEqual(Object.keys(parsed), ["570"]);
    assert.deepEqual(parsed["570"]?.cards, [{ hash: "570-A", title: "Card A" }]);
  });

  it("keeps the bundled card list when the cache twin differs", () => {
    const root = dialogRoot();
    const bundled: BadgeDataset = { 440: { size: 5, cards: [{ hash: "440-Bundled" }] } };
    const cache: BadgeCardCache = {
      440: { size: 5, cards: [{ hash: "440-Cache" }] },
      753: { size: 5, cards: [{ hash: "753-A" }] },
    };
    const downloads: Array<[string, string]> = [];
    triggerDatasetExport(root, bundled, cache, (filename, text) => {
      downloads.push([filename, text]);
    });
    assert.equal(downloads.length, 1);
    const parsed = JSON.parse(downloads[0]![1]) as Record<string, { cards?: Array<{ hash: string }> }>;
    assert.deepEqual(Object.keys(parsed), ["440", "753"]);
    assert.deepEqual(parsed["440"]?.cards, [{ hash: "440-Bundled" }]);
  });

  it("emits archive keys in ascending numeric order", () => {
    const root = dialogRoot();
    const bundled: BadgeDataset = { 570: { size: 6 }, 440: { size: 5, cards: [{ hash: "440-A" }] } };
    const cache: BadgeCardCache = { 753: { size: 5, cards: [{ hash: "753-A" }] } };
    const downloads: Array<[string, string]> = [];
    triggerDatasetExport(root, bundled, cache, (filename, text) => {
      downloads.push([filename, text]);
    });
    assert.equal(downloads.length, 1);
    assert.deepEqual(Object.keys(JSON.parse(downloads[0]![1]) as Record<string, unknown>), ["440", "570", "753"]);
  });

  it("round-trips the downloaded archive through normalizeDataset", () => {
    const root = dialogRoot();
    const bundled: BadgeDataset = {
      440: {
        size: 5,
        name: "Bundled Game",
        cards: [{ hash: "440-A", title: "Card A", iconUrl: "https://example.test/a.jpg" }],
      },
    };
    const cache: BadgeCardCache = {
      753: {
        size: 5,
        name: "Learned",
        cards: [{ hash: "753-A", title: "Card A", iconUrl: "https://example.test/full-a.jpg" }],
      },
    };
    const downloads: Array<[string, string]> = [];
    triggerDatasetExport(root, bundled, cache, (filename, text) => {
      downloads.push([filename, text]);
    });
    assert.equal(downloads.length, 1);
    const reloaded = normalizeDataset(JSON.parse(downloads[0]![1]) as unknown);
    assert.equal(reloaded["440"]?.size, 5);
    assert.equal(reloaded["440"]?.name, "Bundled Game");
    assert.deepEqual(reloaded["440"]?.cards, [
      { hash: "440-A", title: "Card A", iconUrl: "https://example.test/a.jpg" },
    ]);
    assert.equal(reloaded["753"]?.size, 5);
    assert.deepEqual(reloaded["753"]?.cards, [
      { hash: "753-A", title: "Card A", iconUrl: "https://example.test/full-a.jpg" },
    ]);
  });

  it("reflects the count text with singular and plural forms", () => {
    const root = dialogRoot();
    updateDatasetExportState(root, 0);
    assert.equal(root.querySelector("#datasetExportCount")!.textContent, "0 new entries");
    updateDatasetExportState(root, 1);
    assert.equal(buttonIn(root).disabled, false);
    assert.equal(root.querySelector("#datasetExportCount")!.textContent, "1 new entry");
    updateDatasetExportState(root, 2);
    assert.equal(root.querySelector("#datasetExportCount")!.textContent, "2 new entries");
  });

  it("ignores missing dialog elements without throwing", () => {
    const empty = document.createElement("div");
    updateDatasetExportState(empty, 3);
    const downloads: Array<[string, string]> = [];
    triggerDatasetExport(empty, {}, {}, (filename, text) => {
      downloads.push([filename, text]);
    });
    assert.deepEqual(downloads, []);
  });
});
