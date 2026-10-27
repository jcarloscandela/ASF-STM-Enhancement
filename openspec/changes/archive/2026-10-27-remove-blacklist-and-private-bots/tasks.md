# Tasks

## 1. Remove scan-time blacklist and private-bot behavior

- [x] 1.1 Remove blacklist state, filtering, result-row event wiring, private-bot capture/backfill, and save/load/reset paths from `src/ASF-STM.ts`; keep only the current-scan skip after an inaccessible partner badge page. Verify with scan-lifecycle coverage that the partner is skipped for the remainder of the run but is not excluded on a later run.
- [x] 1.2 Remove blacklist controls from `src/templates/rowTemplate.ts` and remove the Blacklist and Private bots tabs/renderers from `src/templates/configDialogTemplate.ts`; renumber the remaining Scan filters and Dataset tab IDs. Verify template tests assert the removed controls/tabs are absent and remaining tabs render correctly.
- [x] 1.3 Remove the obsolete `src/lib/private-bots.ts` module and its `test/private-bots.test.ts` and `test/private-bots-tab.test.ts` suites. Verify no imports or exports still reference the removed module or renderers.

## 2. Remove obsolete persistence and cover migration

- [x] 2.1 Remove blacklist/private-bot entries from the active storage-key API and add an idempotent startup cleanup for `.Blacklist` and `.PrivateBots.v1`, without deleting other stored keys. Verify a migration test seeds both legacy keys plus unrelated settings, bot-cache, Params, badge-card, and scan-resume values and confirms only the two legacy keys are removed.
- [x] 2.2 Update settings/reset, storage, bot-cache, and template tests to remove feature-specific state and expectations; retain generic JSON-storage behavior coverage. Verify the focused test suites pass and reset no longer reads or writes obsolete state.

## 3. Update documentation and release metadata

- [x] 3.1 Remove the feature description and architecture references from `README.md` and `AGENTS.md`, including the private-bots module in the layout and the current-version feature summary. Verify searches of maintained source, tests, and user/contributor docs find no obsolete UI or behavior claims (apart from required legacy-key cleanup identifiers).
- [x] 3.2 Bump `package.json` from `1.0.18` to `1.0.19` (or the next patch if the version has changed before implementation). Verify the package version is the value injected by the existing userscript build configuration.

## 4. Verify the release candidate

- [x] 4.1 Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm format:check`, and `pnpm build`; verify all checks pass and the generated single-file userscript reports the bumped version. Do not commit `dist/`.
