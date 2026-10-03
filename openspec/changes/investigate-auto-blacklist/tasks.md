# Tasks

## 1. Reproduction and harness

- [ ] 1.1 Reproduce the auto-add trigger from the current code path and verify a scratch test or log shows a private-profile skip appends to `TempAsfStm.ASF.STM.Blacklist` via `SaveConfig`
- [ ] 1.2 Add failing fixture tests for the spec deltas (skip leaves persisted blacklist untouched; skipped partner retried next scan; manual add still persists; dedup keeps one copy) and verify they fail on the current code

## 2. Core implementation

- [ ] 2.1 Add a dedup-guarded pure blacklist helper in `src/lib` (e.g. add/parse helper) and wire `blacklistEventHandler` plus the dialog textarea save through it, verified by the new unit tests passing
- [ ] 2.2 Replace the `GetCards` private-profile branch push-plus-`SaveConfig` with a scan-scoped transient skip (cleared at scan start, checked alongside `blacklist` in the bot filter) keeping progress advance and debug trace, verified by the skip-no-persist tests passing
- [ ] 2.3 Confirm manual flows unchanged (row button confirm, textarea save, reset clears all four keys) and verify existing `test/settings.test.ts`, `test/storage.test.ts`, and `test/bot-cache.test.ts` still pass

## 3. Verification and release hygiene

- [ ] 3.1 Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build` and verify all pass with no `// DEBUG` or placeholder tokens in `dist/`
- [ ] 3.2 Bump `package.json` patch version and update `AGENTS.md`/`README.md` if the toolchain, layout, or blacklist behavior description changed, verified by `openspec validate --change "investigate-auto-blacklist"`
