# Tasks

## 1. Fix

- [ ] 1.1 Move `let pendingIndex = 0; let aborted = false;` in `GetOwnCards` (`src/ASF-STM.ts`) above the Phase 1 derivation loop so the `pending.length === 0` early `finish()` call reads initialized state, leaving `finish` and all abort assignments untouched; verify `pnpm typecheck` passes
- [ ] 1.2 Audit sibling scan paths (`fetchInventory`/`GetCards` and their nested guards) for the same read-before-`let` pattern and fix only if the same crash is reachable, otherwise note the outcome; verify by code reading plus `pnpm lint`

## 2. Regression guard

- [ ] 2.1 Add a vitest case asserting the declaration-order invariant inside `GetOwnCards` (`let aborted` / `let pendingIndex` initialized textually before the empty-pending early `finish()` call), failing on the pre-fix source; verify it fails with the fix reverted (`git stash`) and passes with the fix applied
- [ ] 2.2 Run the full gate `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm build` and confirm the built bundle orders the initialization before the early `finish()` call; verify all commands exit zero

## 3. Release hygiene

- [ ] 3.1 Bump `package.json` version (patch minimum) and verify `pnpm build` emits the new version in the userscript header
- [ ] 3.2 Confirm end-to-end in Tampermonkey that a scan with fully covered badges (empty pending path, the reported crash scenario) completes through bot matching with no `ReferenceError`; verify no console error on the badges page
