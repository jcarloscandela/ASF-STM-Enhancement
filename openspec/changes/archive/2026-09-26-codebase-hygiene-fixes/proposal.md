# Proposal

## Why

A deep read of the codebase surfaced one probable live defect (`rgbaToHex` emits malformed hex for color channels below 16), one real per-scan CPU waste (full-badge `JSON.stringify` evaluated even with debug off), and a layer of cruft and near-duplication that slows every future change. Fixing them together is low-risk and keeps the healthy parts untouched.

## What Changes

- Fix `rgbaToHex` to zero-pad each channel to two hex digits, with a regression test using a low-channel color.
- Guard eager `debugPrint(JSON.stringify(...))` call sites (or accept thunks) so full-badge serialization happens only when debug is on.
- Replace `JSON.parse(JSON.stringify(...))` clones with `structuredClone` (matcher core, per-partner badge prep); keep JSON only where the input may not be cloneable.
- Replace the `botSorter` switch with a key→comparator lookup table (same ordering, now unit-testable).
- Deduplicate: `matcher-core` imports `deepClone` from `helpers` instead of hand-rolling it; `BadgeDatasetCard` becomes the single card-shape type in `dataset.ts`.
- Remove cruft: stale `script/build.py` / `.js`-inlining comments (incl. the reference to nonexistent `resolveOwnedCount`), the `^Kfor the Emperor` / `that's fine for us` / `because fuck js` comments, and the dead non-`BigInt` fallback in `getPartner`.
- Fix the `"[object Object]"` interpolation in the `buildMatchStore` count-mismatch error.
- Harden `calcBadgeState` against unsorted input by computing min/max directly instead of relying on positional convention.
- Normalize `==` to `===` with explicit type normalization at the affected boundaries.
- Defer (document only): the `myBadges.splice` on partner parse failure needs a product decision before any behavior change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `shared-helpers`: hex output of the color helpers is zero-padded to six digits (correct remote behavior for channels below 16).

## Impact

- Affected code: `src/lib/helpers.ts`, `src/lib/matcher-core.ts`, `src/lib/dataset.ts`, `src/ASF-STM.ts` (comments, sorter, debug guards, splice comment), `test/helpers.test.ts` (padding regression), plus sorter/clone coverage.
- No settings, persistence, URL, network, or matching-semantics changes; all outputs but the malformed-hex fix stay identical.
- Assumes the sibling changes land independently; if landed together, coordinate a single patch version bump (see tasks).
