# Design

## Context

See proposal.md Why. Current state: `src/ASF-STM.ts` (2116 lines) is a single IIFE with ~60 nested functions over ~20 closure globals (`myBadges`, `botBadges`, `bots`, `tradeParams`, `cardNames`, `globalSettings`, progress radials). Pure logic already lives in `src/lib/*` (matcher-core, tradable, settings, storage, requests, resilience, helpers, dataset, steam-schema) and is vitest-covered with plain fixtures. The untested remainder is orchestration + HTML parsing + DOM building, all inline in the IIFE and therefore unimportable. Constraints: single-file rolldown bundle (normal imports only), strict TS, oxlint/oxfmt, `pnpm typecheck|lint|test|build` green, version bump per change, docs-sync for `AGENTS.md`/`README.md` (whose test section currently mandates "plain fixtures: no browser, no network" — this change intentionally revises that for DOM-harness suites only).

## Goals / Non-Goals

**Goals:**
- Every behavior-preserving slice independently shippable: extract, golden-test, land.
- Maximize line coverage of orchestration/parsing via pure extraction first, DOM harness second.
- Thin host shells: XHR/DOM/cookie code stays in the userscript but as wiring only.

**Non-Goals:**
- No user-visible behavior, matcher, tradability, or URL-contract changes (golden tests enforce).
- No bot-request reduction or caching (separate change; fetch-then-filter stands).
- No migration of existing `src/lib/*` modules.

## Decisions

- **Incremental slices over single restructure** (user-confirmed): each slice = extract pure unit + fixture/golden tests + rewire caller + full gate green. Rationale: always-releasable, bisectable; a big-bang service map risks behavior drift in untestable seams. Alternative (one-pass restructure) rejected.
- **Pure parsers before DOM harness**: `parseGamecardsDocument(doc, ownCards)` (badge-card quantities/titles/icons + unmatched detection), flat-badge predicate shared by own (:848) and bot (:1156) filters, bot-badge builder, match-row view-data builders, trade-page `Cards` selection planner. Rationale: biggest coverage per effort with zero new deps; mirrors the established lib pattern. Alternative (harness-first) rejected — harness without seams still can't reach inline closures.
- **happy-dom preferred, jsdom fallback (spike first)**: needed for progress UI, match-row DOM, and `addCards`/`checkContexts` selection against canned `rgInventory`/`rgContexts`. Rationale: happy-dom is lighter and vitest-native; jsdom fallback if Steam-DOM quirks (`BuildInventoryDisplayElements`, `.show()`) don't emulate. Odd one out: network stays forbidden — XHR/fetch are seam-injected fakes, never real. Rejected: real-browser tests (breaks CI/userscript constraints).
- **Service map as target shape, not a migration step**: ui-shell (DOM building/events), scan-orchestrator (sequencing/retries/progress), badge-source (XHR shells), match-store (persistence), offer-writer (trade-page DOM). Slices converge here file by file (`src/lib/badge-page.ts`, `src/lib/scan-orchestrator.ts`, `src/lib/offer-writer.ts`, …); no file is created until its slice lands.
- **Golden tests lock behavior per slice**: captured pre-extraction outputs (parsed badges, row HTML, Cards lists) replayed post-extraction. Rationale: proves "refactor only" where unit tests can't.

## Risks / Trade-offs

- [Risk] Extraction subtly changes runtime behavior (closure-global ordering, `splice` index interplay in `GetCards`) → Mitigation: golden fixtures from live code paths; land slices smallest-first; full gate per slice.
- [Risk] happy-dom can't emulate Steam page objects → Mitigation: time-boxed spike is task 1.1; fallback to jsdom; last resort keeps those shells thin-and-untested explicitly.
- [Risk] Bundle size/behavior shift from harness leaking into the userscript → Mitigation: harness is devDependency, test-only imports; CI asserts single `dist/` file with no placeholders (existing check).
- [Risk] Test-suite runtime bloat → Mitigation: harness suites use minimal canned DOM; keep pure suites harness-free.

## Migration Plan

No user migration (userscript drop-in). Rollback per slice: revert the slice commit; bundle + version tag per release as usual. Docs (`AGENTS.md`, `README.md`) updated in the final slice so constraints never describe a half-migrated tree.

## Open Questions

- None. Harness choice resolves via the spike inside the task list without changing approach or breakdown.
