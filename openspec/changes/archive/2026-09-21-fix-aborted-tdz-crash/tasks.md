# Tasks

## 1. Fix

- [x] 1.1 Move `let aborted = false` (with `pendingIndex`) above Phase-1 derivation and early `finish()` return in `GetOwnCards()` and verify `pnpm typecheck` passes
- [x] 1.2 Grep scan flow for other use-before-let in the same function and verify no remaining TDZ access

## 2. Regression coverage

- [x] 2.1 Add fixture test for zero-pending fast path (all badges locally resolved → completes without throw, no detail request) and verify `pnpm test` passes

## 3. Release hygiene

- [x] 3.1 Bump `package.json` patch version and verify `pnpm lint` and `pnpm format:check` pass
- [x] 3.2 Rebuild (`pnpm build`) and verify `dist/ASF-STM.user.js` contains no `{{PLACEHOLDER}}` or `// DEBUG` markers
