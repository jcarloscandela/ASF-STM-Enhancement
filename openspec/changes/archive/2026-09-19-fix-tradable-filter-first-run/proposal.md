# Proposal

## Why

The recent non-tradable-card change (commit `0ccba07`, v6.0.0.13) excludes trade-held cards from matches, but the scan now fails on the first execution and only succeeds when run a second time. Users on both scan modes are affected, and there are no automated tests or build checks to catch the regression.

## What Changes

- Diagnose and fix the first-run scan failure introduced by the tradable-card filtering (unconditional upfront inventory fetch in `prepareInventoryScan`, unhandled async rejections, progress-radial state corruption, stale/overwritten `tradableCardCounts` across concurrent runs).
- Make tradable filtering reliable on every run for both scan paths: inventory scan and legacy badge-page scan (including scan-filter mode), preserving the existing fallback to Steam `owned` counts when tradability data is unavailable.
- Add a minimal, dependency-free unit-test suite for the pure tradability helpers (`isTradableDescription`, `buildTradableCardCounts`) plus the scan-eligibility mapping, kept in a separate file so `src/ASF-STM.js` stays a single distributable userscript.
- Harden the build (`script/build.py`) so one command always regenerates **both** distributables (`dist/ASF-STM.user.js` + `dist/ASF-STM.debug.js`), fails loudly on missing templates/placeholders, and is verified by CI; keep the existing template/minify behavior unchanged.
- Small, bounded hygiene fixes only where they directly support the above (e.g. error handling around the badges-DB fetch); no UI redesign, no foil support, no matcher-algorithm changes.

## Capabilities

### New Capabilities

- `tradable-card-filter`: excluding non-tradable (trade-held) cards from badge eligibility, owned counts, and matches reliably on first and subsequent runs, with fallback when inventory data is unavailable.
- `userscript-build`: deterministic build that always produces both `dist` userscript files and validates templates/placeholders, plus a runnable unit-test suite.

### Modified Capabilities

- None (no existing specs exist in `openspec/specs/`).

## Impact

- `src/ASF-STM.js`: `prepareInventoryScan`, `fetchInventory` usage, `getBadgesInventory`, `GetOwnCards` tradable override, progress-radial handling, async error paths.
- New test file(s) (e.g. `test/*.test.js` run with `node --test`, zero new runtime dependencies) + minimal runner wiring.
- `script/build.py`: validation + both-artifact guarantee; `.github/workflows/build.yml`: run tests and verify `dist/` outputs.
- `dist/ASF-STM.user.js`, `dist/ASF-STM.debug.js`: regenerated artifacts.
