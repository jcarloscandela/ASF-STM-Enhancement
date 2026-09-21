# AGENTS.md

Contributor and agent guide for this repository. The user-facing docs live in
`README.md`; this file is the authoritative working reference for how to make
changes here. When the two disagree about commands or layout, fix this file
(see the docs-sync rule below).

## Overview

ASF bot-list trade matcher for Steam Community badges, shipped as a
single-file TypeScript userscript. The scanner matches
the user's tradable cards against ASF bot lists and friends and generates
trade offers. Version `1.0.2`, new home
`https://github.com/jcarloscandela/ASF-STM-Enhancement`.

## Layout

- `src/ASF-STM.ts` — userscript source (strict TypeScript, bundled by
  rolldown into the single distributable).
- `src/lib/*.ts` — strict TypeScript libs (`tradable`, `settings`):
  unit-tested via vitest and bundled via normal imports.
- `src/templates/` — HTML/CSS fragments consumed as TypeScript module
  imports (`*.ts` render functions, `css.css` raw text); no placeholders.
- `rolldown.config.ts` — bundler config (single-file output, version
  define, userscript metadata banner).
- `test/*.test.ts` — vitest suite (plain fixtures, no browser/network).
- `dist/` — gitignored build output (single `ASF-STM.user.js` with debug
  behavior behind the in-app debug setting); published as a release
  asset, never committed.
- `openspec/` — OpenSpec planning artifacts (`specs/` holds the synced main
  specs; `changes/` holds active changes, `changes/archive/` the archived
  ones).

## Working commands

Prerequisites: Node.js 22+ and pnpm 12 (see `packageManager` in
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
- Tests are vitest (`pnpm test`) with plain fixtures: no browser, no network,
  and no new runtime dependencies beyond dev tooling. New behavior needs
  fixture coverage following `test/tradable.test.ts` /
  `test/settings.test.ts`.
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
