# Tasks

## 1. Correctness fixes with tests

- [x] 1.1 Zero-pad `rgbaToHex` channels to two digits and add a low-channel regression test, and verify with `pnpm test` (helpers suite).
- [x] 1.2 Harden `calcBadgeState` to compute min/max directly instead of positional convention, and verify existing matcher tests plus a shuffled-input case pass via `pnpm test`.
- [x] 1.3 Guard eager `debugPrint(JSON.stringify(...))` call sites so serialization runs only when debug is on, and verify with `pnpm test` and a before/after scan timing note.

## 2. Safe cleanups

- [x] 2.1 Replace hand-rolled JSON clones with `deepClone`/`structuredClone` in `matcher-core` and per-partner badge prep, and verify with `pnpm test`.
- [x] 2.2 Convert `botSorter` to a key→comparator table with unit tests covering ordering chains, and verify with `pnpm test`.
- [x] 2.3 Alias the card-shape type in `dataset.ts`, remove stale comments (build.py refs, nonexistent `resolveOwnedCount`, stray remarks), drop the dead `getPartner` fallback, fix the `[object Object]` error text, normalize `==` at type boundaries, and document the deferred `myBadges.splice` product decision in a comment; verify with `pnpm test`.
- [x] 2.4 Move badge-cache tests from `test/tradable.test.ts` into the dataset test file without changing assertions, and verify with `pnpm test`.

## 3. Regression and release gates

- [x] 3.1 Run the full verification suite (`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`) and verify all gates pass with no `dist/` commit.
- [x] 3.2 Bump the patch version once (coordinate a single bump if sibling health changes land together), sync contributor docs, and verify `openspec validate codebase-hygiene-fixes --strict` passes.
