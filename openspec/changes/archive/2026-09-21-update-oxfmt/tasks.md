# Tasks

## 1. Bump and validate the tool swap

- [x] 1.1 Bump `oxfmt` to `^0.68.0` in `package.json` and refresh `pnpm-lock.yaml` (`pnpm install`); verify `pnpm list oxfmt --depth 0` reports `0.68.0`
- [x] 1.2 Check the 0.68.0 CLI/config surface for changes affecting us (run `pnpm oxfmt --help`; compare against `.oxfmtrc.json`) and adjust `.oxfmtrc.json` only if the old settings break or are ignored; verify `pnpm format:check` runs to completion and report what it flags
- [x] 1.3 Run the remaining gates (`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`) and verify all pass with the new formatter installed
- [x] 1.4 Bump the package version (patch) in `package.json` per the versioning rule and verify `pnpm build` emits a userscript header with the new version

## 2. Re-canonicalize the repo and finalize

- [x] 2.1 Run `pnpm format` and verify `git diff` touches only formatting (no logic edits; spot-check a few `src/lib/*.ts` hunks); run `pnpm format:check` and verify it passes
- [x] 2.2 Re-run all gates (`pnpm format:check`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`) and verify all pass on the reformatted tree
- [x] 2.3 Commit the bump and reformat as two logical commits; verify `git log` shows both and the working tree is clean
- [x] 2.4 Update docs if needed per the docs-sync rule (README/AGENTS.md only if they name a formatter behavior that changed; otherwise record "no doc impact") and verify the change doc set is ready to archive
