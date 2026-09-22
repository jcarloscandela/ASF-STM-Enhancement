# ASF-STM-Enhancement

ASF bot-list trade matcher for Steam Community badges, shipped as a single-file TypeScript userscript.

## Origin and reinstall notice

This project began as a fork of `iBreakEverything/ASF-STM-Enhancement` (itself derived from the original [ASF-STM by Rudokhvist](https://github.com/Rudokhvist/ASF-STM)) and has since diverged substantially: full-TypeScript source, vitest suite, `pnpm` toolchain, rolldown bundling, and a version reset to `1.0.0`.

The old fork repository has been deleted, so Tampermonkey auto-update continuity from old installs is broken. **Reinstall from the new release page below** (old `6.x` installs will not auto-update).

New home: `https://github.com/jcarloscandela/ASF-STM-Enhancement`

## Features

- Inventory scan: scan your inventory in only ~10 seconds for typical libraries (\~6,000 card items; +3s per extra ~2,000 items); bundled card dataset and a browser card cache skip badge-detail requests for known games, and badge details for the rest load serially (never in parallel), keeping badge-heavy accounts safe and fast.
- Scan resilience: Steam request failures are classified (rate-limited / auth / transient / unknown) and a circuit breaker fails fast with a visible cooldown during rate-limit windows, recovering automatically instead of hammering a throttled endpoint.
- Card datasets: `data/badge_cards.json` is the single bundled card dataset — full card lists with display titles and artwork for covered games plus set sizes for the rest — shipped in a compact encoding (short keys, shared icon-URL prefix stripped) and bundled into the userscript at build time. Covered games skip the badge-detail API entirely (with real names and artwork from the first run); unknown games fall back to it serially, and what it learns is cached in the browser for next time.
- Friend match: match with your public-inventory friends (friends-only/private inventories mark badges as private).
- Scan filters: add badge `appId` filters to skip full scans and cut scan time.
- Trade matching: match your cards against ASF bot lists and friends, then offer trades per badge, for all results, or for filtered results. Set progress and requests use owned copies — a card you already own is never requested, even when every copy is temporarily trade-held — and offers are capped at your tradable copies in excess of the set target the badge must retain (`max(tradable − target, 0)`, so the retained copies are never spent, even when more owned copies are held). Badges are only checked against bots when they have a receivable slot *and* tradable surplus to trade with, and partners are only asked for cards they can spare while keeping at least one copy themselves.
- Tradability-aware counting: excludes foil cards, dated trade holds (`Tradable After`), and non-card items from what can be offered; trade-held copies still count as owned. When a game is missing from the tradability lookup, its owned copies are treated as tradable (matching falls back to owned counts).
- Updated UI: clickable buttons, nickname sanitization, scrollable menus, links to trade partner badges, scan progress bar.
- Single distributable: `dist/ASF-STM.user.js`, built from TypeScript sources with one command; debug output is available behind the in-app debug setting instead of a separate file.

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/) for your browser.
2. In Chromium-based browsers, allow userscripts: go to `chrome://extensions`, open Details on Tampermonkey, enable **Allow User Scripts**.
3. Go to [the latest release](https://github.com/jcarloscandela/ASF-STM-Enhancement/releases/latest) and install **ASF-STM.user.js** from the assets. If you previously installed **ASF-STM.debug.js**, reinstall **ASF-STM.user.js** instead — the debug variant is retired; enable debugging in the settings dialog (⚙️ → Developer → Debug).

## Usage

1. [Install](#installation) the script.
2. Navigate to [your Steam badges](https://steamcommunity.com/my/badges/) page.
   - **Optional**: match with friends:
     1. Click the ⚙️ button.
     2. Check `Match with friends`.
     3. Click Save.
   - **Advanced**: scan filters:
     1. Click the ⚙️ button.
     2. Go to the `Scan filters` tab.
     3. Add the `appId` of each badge you want to match.
     4. Click Save.
3. Click the `Scan ASF STM` button next to your avatar.
4. Wait for the initial scan to complete.
5. Offer a trade per badge, for all results, or filter first and offer for the remainder.

## Development

Prerequisites: Node.js 22.12+ and [pnpm](https://pnpm.io/) 12 (see `packageManager` in `package.json`).

```sh
pnpm install --frozen-lockfile
pnpm typecheck   # tsc --noEmit (strict)
pnpm lint        # oxlint
pnpm test        # vitest, launched via the Oxc runner hook
pnpm build       # rolldown bundle; rebuilds dist/ASF-STM.user.js
pnpm format      # oxfmt src scripts test rolldown.config.ts (writes in place)
pnpm format:check  # oxfmt --check (same scope)
```

TypeScript execution uses the Oxc runner (`node --import
@oxc-node/core/register`, `oxnode` CLI for watch mode) — experimental,
pinned exactly (`@oxc-node/cli` + `@oxc-node/core` `0.1.3`). It strips types
without checking, so `pnpm typecheck` remains the type gate. Rollback to
`tsx`: restore `tsx` in `devDependencies`, set `build` back to
`tsx scripts/build.ts` and `test` back to `vitest run`, then
`pnpm install`.

CI (`.github/workflows/build.yml`) runs typecheck, lint, tests, and build on push/PR, then verifies `dist/ASF-STM.user.js` exists with no unreplaced `{{PLACEHOLDER}}` tokens and no `// DEBUG` markers.

### Layout

- `src/ASF-STM.ts` — userscript source (strict TypeScript, bundled by rolldown).
- `src/lib/*.ts` — strict TypeScript libs: `models` (canonical type-only declarations), `tradable`, `settings`, `steam-schema` (Zod payload validation), `matcher-core` (pure matching incl. the tradeoffer handoff), `helpers` (pure utilities), `storage` (typed JSON persistence), `requests` (GM request resolution/GET/retry), `badge-page` (gamecards parser, badge ordering/set sizes), `match-row` (match-row view data), `offer-writer` (offer selection planner), unit-tested via vitest and bundled via normal imports.
- `src/templates/` — HTML/CSS fragments consumed as TypeScript module imports (`*.ts` render functions, `css.css` raw text).
- `rolldown.config.ts` — bundler config (single-file output, version define, userscript metadata banner).
- `test/*.test.ts` — vitest suite (plain fixtures, no network; DOM-needing suites use the happy-dom harness with canned documents).
- `dist/` — gitignored build output, published as release assets.

### Versioning and releases

The single version source is `package.json` (`1.0.2`). The build injects it into the userscript header, so the shipped file, package metadata, and the release tag always agree. Bumping the version on the default branch (`master`) runs the full pipeline and drafts a GitHub release named `ASF-STM-Enhancement V<version>` carrying the single distributable.
