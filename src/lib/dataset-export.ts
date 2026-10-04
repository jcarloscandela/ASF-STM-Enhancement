// Dataset-export dialog wiring: button state and the badge_cards.json download.
// The download carries the full merged archive (bundled dataset + new
// entries); gating, counting, and button state still run on the new-entry
// diff. Pure coordination over `src/lib/dataset.ts` plus minimal DOM updates;
// the userscript keeps only thin host wiring (Blob download, event listeners).
// Tested with canned documents under happy-dom, never a browser.

import {
  diffNewBadgeCardEntries,
  mergeBadgeCardsForExport,
  serializeBadgeCardsExport,
  type BadgeCardCache,
  type BadgeDataset,
} from "./dataset";

export const DATASET_EXPORT_BUTTON_ID = "downloadBadgeCardsButton";
export const DATASET_EXPORT_COUNT_ID = "datasetExportCount";
export const DATASET_EXPORT_FILENAME = "badge_cards.json";

/** Counts the cache entries not yet covered by the bundled dataset. */
export function newBadgeCardsCount(dataset: BadgeDataset, cache: BadgeCardCache): number {
  return Object.keys(diffNewBadgeCardEntries(dataset, cache)).length;
}

/** Reflects the new-entry count in the Dataset tab: count text plus the
 * button's disabled state. Missing elements are ignored so the call is safe
 * when the config dialog is not open. */
export function updateDatasetExportState(root: ParentNode, newCount: number): void {
  const button = root.querySelector(`#${DATASET_EXPORT_BUTTON_ID}`) as HTMLButtonElement | null;
  const count = root.querySelector(`#${DATASET_EXPORT_COUNT_ID}`);
  if (button !== null) {
    button.disabled = newCount === 0;
  }
  if (count !== null) {
    count.textContent = newCount === 1 ? "1 new entry" : `${newCount} new entries`;
  }
}

/** Recomputes the new-entry diff, refreshes the button state, and downloads
 * the full merged archive (`badge_cards.json`) through `download` when at
 * least one new entry exists. An empty diff only refreshes the disabled
 * state and never downloads. */
export function triggerDatasetExport(
  root: ParentNode,
  dataset: BadgeDataset,
  cache: BadgeCardCache,
  download: (filename: string, text: string) => void,
): void {
  const fresh = diffNewBadgeCardEntries(dataset, cache);
  const count = Object.keys(fresh).length;
  updateDatasetExportState(root, count);
  if (count === 0) {
    return;
  }
  download(DATASET_EXPORT_FILENAME, serializeBadgeCardsExport(mergeBadgeCardsForExport(dataset, fresh)));
}
