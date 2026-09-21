# AGENTS.md

Contributor and agent guide for this repository. The user-facing docs live in
`README.md`; this file is the authoritative working reference for how to make
changes here. When the two disagree about commands or layout, fix this file
(see the docs-sync rule below).

## Overview

ASF bot-list trade matcher for Steam Community badges, shipped as a
single-file userscript with release and debug variants. The scanner matches
the user's tradable cards against ASF bot lists and friends and generates
trade offers. Version `1.0.0`, new home
`https://github.com/jcarloscandela/ASF-STM-Enhancement`.

## Layout

- `src/ASF-STM.js` — userscript body (plain JavaScript; full conversion to
  TypeScript is deferred).
- `src/lib/*.ts` — strict TypeScript libs (`tradable`, `settings`):
  unit-tested via vitest and compiled/inlined into the bundle at build time.
- `src/templates/` — HTML/CSS/JS fragments expanded into
  `{{PLACEHOLDERS}}` by the build.
- `scripts/build.ts` — Node/TypeScript builder (run via `pnpm build`).
- `test/*.test.ts` — vitest suite (plain fixtures, no browser/network).
- `dist/` — gitignored build output (`ASF-STM.user.js` release with debug
  lines stripped, `ASF-STM.debug.js` with debug lines kept); published as
  release assets, never committed.
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
pnpm test         # vitest run
pnpm build        # rebuild dist/ASF-STM.user.js + dist/ASF-STM.debug.js
pnpm format       # oxfmt src/lib test scripts (writes in place)
pnpm format:check # oxfmt --check
```

CI (`.github/workflows/build.yml`) runs typecheck, lint, tests, and build on
push/PR, then verifies both `dist/` files exist with no unreplaced
`{{PLACEHOLDER}}` tokens.

## Code conventions

- Strict TypeScript in `src/lib/*.ts` (`strict: true` in `tsconfig.json`);
  verify with `pnpm typecheck`. Exported Steam-payload types are the contract
  between the scanner fixtures, the tests, and the inlined bundle output.
- Lint with `pnpm lint` (oxlint) and format with `pnpm format` (oxfmt,
  `printWidth: 120` in `.oxfmtrc.json`); both must pass (`pnpm format:check`
  for the read-only check). There is no prettier config.
- Tests are vitest (`pnpm test`) with plain fixtures: no browser, no network,
  and no new runtime dependencies beyond dev tooling. New behavior needs
  fixture coverage following `test/tradable.test.ts` /
  `test/settings.test.ts`.
- Build placeholder discipline: every `{{PLACEHOLDER}}` in `src/ASF-STM.js`
  must have a matching template or compiled lib, and the build fails non-zero
  naming any missing template or unreplaced placeholder. Never commit a
  `dist/` file containing a `{{PLACEHOLDER}}` token. `dist/` itself stays
  gitignored and CI-built.

## MUST rules

- Docs-sync: any architecture-relevant addition or modification MUST update
  `AGENTS.md` and/or `README.md` in the same change, so contributor docs
  cannot drift from the toolchain, layout, or commands they describe.
- Versioning: any change touching `src/`, `scripts/`, or `test/` MUST bump
  the `package.json` version (patch at minimum). `package.json` is the single
  version source: the build injects it into both userscript headers and the
  release flow tags from it, so the shipped files, package metadata, and
  release tag always agree.
