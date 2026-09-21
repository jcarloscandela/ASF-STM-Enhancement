# Proposal

## Why

Every scan crashes with `Uncaught ReferenceError: Cannot access 'aborted' before initialization` at `finish` ← `GetOwnCards` whenever all candidate badges derive locally (no serial badge-detail fetch needed) — exactly the fast path the bundled dataset and browser cache exist to provide. The scan never reaches bot matching, so the userscript is unusable whenever coverage is complete.

## What Changes

- Move the `aborted` (and `pendingIndex`) state initialization in `GetOwnCards` (`src/ASF-STM.ts`) above the early `finish()` call for the empty-pending path, eliminating the temporal-dead-zone access.
- No behavior change beyond the crash fix: the empty-pending path still calls `finish()` directly with `aborted` reading `false`, and the serial-fetch path keeps its existing abort semantics.
- Add a regression guard that fails if `finish` can observe uninitialized guard state (e.g. a static check or a minimal harness invoking the empty-pending path), so the defect cannot be reintroduced silently.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

(none) — this restores behavior the `trade-matching` spec already requires (covered games derive locally with no badge-detail request); no requirement text changes. The change sets `skip_specs: true` in its `.openspec.yaml`.

## Impact

- `src/ASF-STM.ts` — `GetOwnCards` only: reorder two declarations; no API, storage, settings, or network changes.
- `test/` — one regression test/guard for the empty-pending path.
- Docs: none (no user-visible behavior beyond the crash disappearing). Version bump per repo rules (`package.json` patch).
