// Bot-list ordering as a key→comparator lookup table, extracted from the
// `botSorter` switch in `src/ASF-STM.ts` with identical ordering semantics.
//
// Host-free by design: the caller supplies the ordered sort keys (user
// settings), so the table is unit-testable without a browser and stays
// bundled single-file.

import type { BotEntry } from "./models";

/** One named ordering over two bot entries. */
export type BotComparator = (a: BotEntry, b: BotEntry) => number;

const comparators: Record<string, BotComparator> = {
  MatchEverythingFirst: (a, b) => Number(b.MatchEverything) - Number(a.MatchEverything),
  MatchEverythingLast: (a, b) => Number(a.MatchEverything) - Number(b.MatchEverything),
  TotalGamesCountDesc: (a, b) => Number(b.TotalGamesCount) - Number(a.TotalGamesCount),
  TotalGamesCountAsc: (a, b) => Number(a.TotalGamesCount) - Number(b.TotalGamesCount),
  TotalItemsCountDesc: (a, b) => Number(b.TotalItemsCount) - Number(a.TotalItemsCount),
  TotalItemsCountAsc: (a, b) => Number(a.TotalItemsCount) - Number(b.TotalItemsCount),
  TotalInventoryCountDesc: (a, b) => b.TotalInventoryCount - a.TotalInventoryCount,
  TotalInventoryCountAsc: (a, b) => a.TotalInventoryCount - b.TotalInventoryCount,
};

/**
 * Orders two bot entries by the first sort key that distinguishes them.
 * Unknown keys are ignored, matching the previous switch fall-through.
 */
export function compareBots(a: BotEntry, b: BotEntry, sortKeys: string[]): number {
  for (const key of sortKeys) {
    const compare = comparators[key];
    if (compare === undefined) {
      continue;
    }
    const result = compare(a, b);
    if (result !== 0) {
      return result;
    }
  }
  return 0;
}
