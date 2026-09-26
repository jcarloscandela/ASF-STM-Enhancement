# Proposal

## Why

The `present but not tradable right now` abort still fires on cards the scan counted as tradable (e.g. owned 3 with 2 temporally blocked), and the previous change proved the metadata verdict itself is consistent — so the divergence is in the live offer-page data, which the planner trusts blindly. Separately, the installed script still reports `@version 1.0.9` even though `package.json` is at 1.0.10, so users cannot tell whether they run the latest fix.

## What Changes

- Offer selection stops trusting pool metadata alone for `unselectable` copies: when a requested name is present but no copy passes the metadata verdict, the handoff SHALL retry each present copy against the live trade (ground truth) and keep the copies Steam actually accepts, aborting loudly only for copies Steam truly rejects.
- Every shortfall record gains per-copy diagnostics (pool copy count, `tradable` flag values seen, hold text/date parsed, scan-time tradable count for that card) in the debug log, so the next occurrence captures the real divergence instead of another guess.
- Version staleness: verify the built header carries the `package.json` version (the build already injects it — confirmed in `rolldown.config.ts`), then cut and publish the pending release so Tampermonkey picks up 1.0.10; no build-mechanism change.
- Fixture coverage for the retry path (held-then-tradable pool ordering) in `test/offer-harness.test.ts`.

## Capabilities

### New Capabilities

- None (behavior fix within existing capabilities; release step is an action, not a new behavior).

### Modified Capabilities

- `trade-offer-handoff`: offer selection must retry present-but-metadata-unselectable copies against the live trade and keep accepted ones; shortfall diagnostics must include per-copy verdict detail.

## Impact

- `src/lib/offer-writer.ts` (retry planner + diagnostic record), `src/ASF-STM.ts` thin wiring (attempt/verify moves, dialog data), tests in `test/offer-harness.test.ts`.
- Release action: tag + publish GitHub release for 1.0.10 (existing `userscript-release` flow, no spec change — its requirements already cover this).
- No storage-schema, matcher-sizing, or metadata-format changes.
