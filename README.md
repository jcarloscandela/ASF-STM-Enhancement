# ASF-STM-Enhancement

ASF bot-list trade matcher for Steam Community badges, shipped as a single-file userscript with release and debug variants.

## Origin and reinstall notice

This project began as a fork of `iBreakEverything/ASF-STM-Enhancement` (itself derived from the original [ASF-STM by Rudokhvist](https://github.com/Rudokhvist/ASF-STM)) and has since diverged substantially: TypeScript libs, vitest suite, `pnpm` toolchain, Node-based build, and a version reset to `1.0.0`.

The old fork repository has been deleted, so Tampermonkey auto-update continuity from old installs is broken. **Reinstall from the new release page below** (old `6.x` installs will not auto-update).

New home: `https://github.com/jcarloscandela/ASF-STM-Enhancement`

## Features

- Inventory scan: scan your inventory in only ~10 seconds for typical libraries (\~6,000 card items; +3s per extra ~2,000 items).
- Friend match: match with your public-inventory friends (friends-only/private inventories mark badges as private).
- Scan filters: add badge `appId` filters to skip full scans and cut scan time.
- Trade matching: match your tradable cards against ASF bot lists and friends, then offer trades per badge, for all results, or for filtered results.
- Tradability-aware counting: excludes non-tradable cards, foil cards, dated trade holds (`Tradable After`), and non-card items; falls back to badge-page owned counts when inventory data is unknown.
- Updated UI: clickable buttons, nickname sanitization, scrollable menus, links to trade partner badges, scan progress bar.
- Release/debug distributables: `dist/ASF-STM.user.js` (debug lines stripped) and `dist/ASF-STM.debug.js` (debug lines kept), built from one command.

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/) for your browser.
2. In Chromium-based browsers, allow userscripts: go to `chrome://extensions`, open Details on Tampermonkey, enable **Allow User Scripts**.
3. Go to [the latest release](https://github.com/jcarloscandela/ASF-STM-Enhancement/releases/latest) and install **ASF-STM.user.js** from the assets (use **ASF-STM.debug.js** only for troubleshooting).

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

Prerequisites: Node.js 22+ and [pnpm](https://pnpm.io/) 12 (see `packageManager` in `package.json`).

```sh
pnpm install --frozen-lockfile
pnpm typecheck   # tsc --noEmit (strict)
pnpm lint        # oxlint
pnpm test        # vitest run
pnpm build       # rebuild dist/ASF-STM.user.js + dist/ASF-STM.debug.js
pnpm format      # oxfmt write
pnpm format:check  # oxfmt --check
```

CI (`.github/workflows/build.yml`) runs typecheck, lint, tests, and build on push/PR, then verifies both `dist/` files exist with no unreplaced `{{PLACEHOLDER}}` tokens.

### Layout

- `src/ASF-STM.js` — userscript body (stays JavaScript in this iteration).
- `src/lib/*.ts` — strict TypeScript libs (`tradable`, `settings`), unit-tested via vitest and compiled/inlined into the bundle at build time.
- `src/templates/` — HTML/CSS/JS fragments expanded into `{{PLACEHOLDERS}}` by the build.
- `scripts/build.ts` — Node/TypeScript builder (run via `pnpm build`); fails non-zero naming any missing template or placeholder.
- `test/*.test.ts` — vitest suite (plain fixtures, no browser/network).
- `dist/` — gitignored build output, published as release assets.

### Versioning and releases

The single version source is `package.json` (`1.0.0`). The build injects it into both userscript headers, so shipped files, package metadata, and the release tag always agree. Bumping the version on the default branch (`master`) runs the full pipeline and drafts a GitHub release named `ASF-STM-Enhancement V<version>` carrying both distributables.
