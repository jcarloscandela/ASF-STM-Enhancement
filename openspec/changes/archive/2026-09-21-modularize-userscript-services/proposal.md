# Proposal

## Why

`src/ASF-STM.ts` is a 2116-line IIFE god-module (~60 nested functions sharing ~20 closure globals) where XHR, HTML parsing, scan sequencing, persistence, and DOM rendering are interleaved. The pure decisions underneath are already extracted and tested (`src/lib/*`), but the orchestration/parsing layer — the largest remaining surface and the source of recent regressions — has zero fixture coverage because it cannot be imported or driven in tests.

## What Changes

- Slice the userscript into independently shippable extractions, one service seam at a time: pure badge-page parsers (`parseGamecardsDocument`, flat-badge filter, bot-badge builder), scan sequencing/decisions, match-row rendering data, and the trade-page offer-writer — each moved to `src/lib/*` behind the existing import/bundle discipline with golden tests locking byte-identical behavior.
- Add a DOM harness dev dependency (happy-dom preferred, jsdom fallback after spike) so orchestration/DOM code (scan progress, match rows, offer selection) is tested against fixtures with no browser and no network.
- Keep every slice behavior-preserving: full suite green plus golden tests per slice; no user-visible change.
- Update contributor docs (`AGENTS.md`, test conventions) for the harness and the new module map in the same change (docs-sync rule).

## Capabilities

### New Capabilities

- none (pure refactor + test tooling; no user-visible behavior changes)

### Modified Capabilities

- none (all existing spec requirements stay satisfied by construction; golden tests enforce it)

## Impact

- `src/ASF-STM.ts` (shrinks slice by slice into thin host wiring), new `src/lib/*` modules, `test/*.test.ts` (new fixture + harness suites), `package.json`/`pnpm-lock.yaml` (one DOM-harness dev dependency), `AGENTS.md` + `README.md` (test-constraint and layout updates), `package.json` version bump per repo rule.
