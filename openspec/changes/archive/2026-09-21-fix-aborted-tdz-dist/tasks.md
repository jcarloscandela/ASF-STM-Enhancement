# Tasks

## 1. Fix

- [x] 1.1 Hoist `let aborted = false` (with `pendingIndex`) above Phase-1 derivation and the zero-pending early `finish()` return in `GetOwnCards()` and verify `pnpm typecheck` passes
- [x] 1.2 Grep the scan flow for other use-before-let accesses and verify no remaining TDZ read on the fast path

## 2. Regression coverage

- [x] 2.1 Add a fixture-level test for the zero-pending path (all badges locally resolved, completes without throw and without detail requests) and verify `pnpm test` passes

## 3. Tampermonkey/GreasyFork ship

- [x] 3.1 Bump the `package.json` patch version and verify `pnpm lint` and `pnpm format:check` pass
- [x] 3.2 Rebuild the single `dist/ASF-STM.user.js` via `pnpm build` and verify it carries the new version with no `{{PLACEHOLDER}}` tokens and no `// DEBUG` markers
- [x] 3.3 Verify the release flow (CI typecheck/lint/test/build plus version-tagged GitHub release carrying the fixed asset) so the Tampermonkey/GreasyFork update delivers the fix
