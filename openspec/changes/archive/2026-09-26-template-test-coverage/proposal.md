# Proposal

## Why

`src/templates/` (config dialog, match/row/main renderers, CSS) has zero test coverage — the largest untested surface in the repo — and pure host string-builders like `createScanFilterElement` are stranded inside the untestable userscript closure. Render regressions currently reach users instead of CI.

## What Changes

- Add `test/templates.test.ts` covering every template render function: structure assertions (ids, classes, data attributes), escaping of untrusted content (nicknames, game names), and the CSS bundle presence.
- Relocate `createScanFilterElement` from the host closure to an importable home with byte-identical output, and cover its active/inactive variants.
- Add adversarial codec cases for the compact `=`-escape and `\0`-sentinel paths in the dataset tests.
- No rendered output changes: all assertions pin current output; any diff is a test failure, not an update.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None — test-only change with behavior-preserving relocations; `skip_specs: true` is set in `.openspec.yaml`.

## Impact

- Affected code: new `test/templates.test.ts`, dataset codec cases, one relocation (host → importable module) with identical output.
- No settings, persistence, URL, network, matching, or rendering changes.
- Assumes sibling changes land independently; if landed together, coordinate a single patch version bump (see tasks).
