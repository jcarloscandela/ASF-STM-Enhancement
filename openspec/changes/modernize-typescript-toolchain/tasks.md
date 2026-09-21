# Tasks

## 1. Toolchain bootstrap

- [x] 1.1 Add `package.json` (pnpm, scripts: build/test/lint/format/typecheck, version `1.0.0`), install, and verify `pnpm install` succeeds with a committed lockfile.
- [x] 1.2 Add `tsconfig.json` (strict), vitest config, and oxlint/oxfmt configs, delete `.prettierrc`, and verify `pnpm typecheck` and `pnpm lint` run clean on an empty source set.

## 2. TypeScript port (libs first)

- [x] 2.1 Port `src/lib/tradable.js` and `src/lib/settings.js` to strict TypeScript with exported Steam-payload types, and verify `pnpm typecheck` passes with no errors.
- [x] 2.2 Migrate `test/*.test.js` to vitest with identical fixtures and expectations, and verify `pnpm test` passes with the same test count as the old `node --test` suite.
- [x] 2.3 Run oxfmt over the repo, review the diff, and verify `pnpm format --check` and `pnpm lint` both pass.

## 3. Node build without Python

- [x] 3.1 Implement `scripts/build.ts` (run via `pnpm build`) replicating `build.py` placeholder semantics for templates and compiled TS libs, delete `script/build.py` and `src/templates/version`, and verify it fails non-zero naming any missing template or placeholder.
- [x] 3.2 Build both distributables and verify output parity: no `{{PLACEHOLDER}}` tokens, version `1.0.0` in both headers, no debug-marked lines in release, and no functional diff vs the Python-built output except version/formatting.

## 4. CI update

- [x] 4.1 Rewrite the workflow to run pnpm typecheck, lint, tests, and build plus dist/placeholder verification on push/PR, and verify a CI run is fully green.
- [x] 4.2 Keep the version-bump draft-release step working against `package.json`, and verify a dry assessment shows it triggers only when the declared version increases.

## 5. Version and README

- [x] 5.1 Set the single version source to `1.0.0` and verify the built headers, package metadata, and (later) release tag all agree.
- [x] 5.2 Rewrite `README.md` (features, pnpm toolchain docs, fork-origin/divergence note, reinstall notice for the new repo URL) and verify every command and link in it works from a clean checkout.

## 6. New repository and 1.0.0 release

- [ ] 6.1 Confirm the new repo owner (assumed `jcarloscandela`), create public `ASF-STM-Enhancement`, repoint `origin`, push history and tags, and verify the remote branch is up to date.
- [ ] 6.2 Publish the `1.0.0` release from CI-built assets and verify the release page lists both distributables and the install URL matches the README.
