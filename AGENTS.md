# AGENTS.md

Contributor and agent guide for this repository. The user-facing docs live in
`README.md`; this file is the authoritative working reference for how to make
changes here. When the two disagree about commands or layout, fix this file
(see the docs-sync rule below).

## Overview

ASF bot-list trade matcher for Steam Community badges, shipped as a
single-file TypeScript userscript. The scanner matches the user's cards
against ASF bot lists and friends and generates trade offers: set progress
and requests use owned copies (an already-owned card is never requested),
offers are capped at owned copies above the applicable set target, further
limited to currently-tradable copies (offerable =
`max(min(tradable, owned − target), 0)` — the retained owned copies are never
spent, while a tradable copy above them is offerable even when every other
owned copy is held), fair partners are only asked for cards they can spare while keeping at
least one copy (and only take badge-neutral swaps), while any-cards (ANY-mode)
partners are treated as pure card sources — they only need to own the card
(`owned > 0`), even their last copy — badges reach bot checks only when a receivable slot and
tradable surplus both exist, and a game missing from the tradability lookup
treats every owned copy as tradable. Candidate badge details
resolve from the single bundled card dataset and a browser card cache first; covered games need
no badge-detail request at all on the first run — cards render with bundled
titles and artwork. Badge-detail requests run serially (never parallel) and
only for games whose card data is not yet known. An interrupted badge-detail phase leaves a per-tab `sessionStorage` resume record that the next same-plan scan continues from (cleared on completion or stop). Version `1.0.11`, new home
`https://github.com/jcarloscandela/ASF-STM-Enhancement`.

## Layout

- `src/ASF-STM.ts` — userscript source (strict TypeScript, bundled by
  rolldown into the single distributable).
- `src/lib/*.ts` — strict TypeScript libs: `models` (canonical type-only
  declarations), `tradable` (tradability/counting), `settings` (validated
  defaults, merge, scan-plan routing), `steam-schema` (Zod-validated Steam
  payloads), `matcher-core` (pure trade matching incl. the tradeoffer handoff
  and its empty-offer diagnosis),
  `helpers` (pure utilities), `storage` (typed JSON persistence), `bot-cache` (bot-listing cache read/write/invalidate), `scan-resume` (temporary interrupted-scan resume record), `requests`
  (GM request resolution, GET, retry policy), `resilience` (scan error
  classification, rate-limit circuit breaker), `badge-page` (gamecards-page
  parser, badge ordering/set-size normalization), `match-row` (match-row
  view-data builders), `offer-writer` (trade-offer selection planner,
  readiness poll). All unit-tested via vitest and bundled via normal imports.
  `src/ASF-STM.ts` keeps only thin host wiring (XHR shells, DOM building,
  cookies, timers); behavior lives in `src/lib/*`.
- `src/templates/` — HTML/CSS fragments consumed as TypeScript module
  imports (`*.ts` render functions, `css.css` raw text); no placeholders.
- `rolldown.config.ts` — bundler config (single-file output, version
  define, userscript metadata banner).
- `test/*.test.ts` — vitest suite (plain fixtures, no browser/network).
- `dist/` — gitignored build output (single `ASF-STM.user.js` with debug
  behavior behind the in-app debug setting); published as a release
  asset, never committed.
- `data/badge_cards.json` — single bundled card dataset, kept as readable
  authoring source (long keys `size`/`name`/`cards` + `hash`/`title`/`iconUrl`
  with full icon URLs) and compacted at publish time by the rolldown
  `badge-cards-compact` plugin into dense tuple arrays (`[size, name, cards]`
  with `[hashSuffix, title, iconTail]` cards, `"<appId>-"` hash prefixes
  elided and the shared `BUNDLED_ICON_URL_PREFIX` bytes stripped;
  `normalizeDataset` decodes the publish encoding and still accepts the
  legacy long keys and short keys `s`/`n`/`c`/`h`/`t`/`u`) with rich entries
  (`size` + full card list of exact market hashes, display titles, and icon
  paths) plus size-only entries folded in from the old counts export. Regenerate it from
  the steam-cards-bot export (cards query for the rich entries, `card_counts`
  table for the size-only entries); the regeneration step MUST assert the icon
  prefix across every icon and fail on mismatch. Covered games derive complete
  badge slots locally on the first run with bundled titles and artwork; the
  rest fall back to the badge-detail API serially. Learned card lists persist
  in the browser (`TempAsfStm.ASF.STM.BadgeCards.v1`).
- `openspec/` — OpenSpec planning artifacts (`specs/` holds the synced main
  specs; `changes/` holds active changes, `changes/archive/` the archived
  ones).

## Working commands

Prerequisites: Node.js 22.12+ and pnpm 12 (see `packageManager` in
`package.json`).

```sh
pnpm install --frozen-lockfile
pnpm typecheck    # tsc --noEmit (strict)
pnpm lint         # oxlint
pnpm test         # vitest, launched via the Oxc runner hook
pnpm build        # rolldown bundle; rebuilds dist/ASF-STM.user.js
pnpm format       # oxfmt src scripts test rolldown.config.ts (writes in place)
pnpm format:check # oxfmt --check (same scope)
```

TypeScript execution uses the Oxc runner (`node --import
@oxc-node/core/register`, `oxnode` CLI for watch mode) — experimental,
pinned exactly (`@oxc-node/cli` + `@oxc-node/core` `0.1.3`). It strips types
without checking, so `pnpm typecheck` remains the type gate. Rollback to
`tsx`: restore `tsx` in `devDependencies`, set `build` back to
`tsx scripts/build.ts` and `test` back to `vitest run`, then `pnpm install`.

CI (`.github/workflows/build.yml`) runs typecheck, lint, tests, and build on
push/PR, then verifies the single `dist/` file exists with no unreplaced
`{{PLACEHOLDER}}` tokens and no `// DEBUG` markers.

## Code conventions

- Strict TypeScript in `src/**/*.ts` (`strict: true` in `tsconfig.json`);
  verify with `pnpm typecheck`. Exported Steam-payload types are the contract
  between the scanner fixtures, the tests, and the bundled output.
- Lint with `pnpm lint` (oxlint) and format with `pnpm format` (oxfmt,
  `printWidth: 120` in `.oxfmtrc.json`); both must pass (`pnpm format:check`
  for the read-only check). There is no prettier config.
- Tests are vitest (`pnpm test`) with plain fixtures and no network, and no
  new runtime dependencies beyond dev tooling. Pure suites use no DOM;
  DOM-needing suites opt in per file (`// @vitest-environment happy-dom`,
  devDependency `happy-dom`) with canned documents and faked XHR seams —
  never a browser, never the network. New behavior needs fixture coverage
  following `test/tradable.test.ts` / `test/settings.test.ts`; new
  DOM-touching behavior follows `test/offer-harness.test.ts`.
  Coverage of `src/lib` is reported via `@vitest/coverage-v8`
  (`vitest run --coverage`, dev-only).
- Single-file build discipline: `src/ASF-STM.ts` plus `src/lib/*.ts` and
  `src/templates/` compile via rolldown (`rolldown.config.ts`) into the one
  self-contained `dist/ASF-STM.user.js`. There is no builder script and no
  `{{PLACEHOLDER}}` mechanism; template HTML lives in typed render
  functions, the CSS arrives as a text import, and the version plus the
  userscript metadata block come from the bundler config. Never commit a
  `dist/` file. `dist/` itself stays gitignored and CI-built.

## MUST rules

- Docs-sync: any architecture-relevant addition or modification MUST update
  `AGENTS.md` and/or `README.md` in the same change, so contributor docs
  cannot drift from the toolchain, layout, or commands they describe.
- Versioning: any change touching `src/`, `scripts/`, or `test/` MUST bump
  the `package.json` version (patch at minimum). `package.json` is the single
  version source: the build injects it into the userscript header and the
  release flow tags from it, so the shipped file, package metadata, and
  release tag always agree.
