# Proposal

## Why

The scan crashes on Steam badge pages with `ReferenceError: Cannot access 'aborted' before initialization` (`finish` ← `GetOwnCards`) whenever every badge resolves from local card data, and the user installs and runs the script via Tampermonkey/GreasyFork — so the fix must be shippable through that exact distribution path.

## What Changes

- Fix the temporal-dead-zone crash in `GetOwnCards()`: make the `aborted` cancellation flag initialized before the zero-pending early `finish()` return.
- Keep the fix inside the normal single-file pipeline (`src/` → `pnpm build` → `dist/ASF-STM.user.js`) so it ships via the existing Tampermonkey/GreasyFork install flow with no alternative runtime or install method.
- Add a fixture-level regression test for the zero-pending fast path and bump the patch version.

## Capabilities

### New Capabilities

- `scan-lifecycle`: zero-pending badge scan completes via the local-data fast path without throwing and without badge-detail requests.

### Modified Capabilities

- `userscript-build`: rebuilt single self-contained `dist/ASF-STM.user.js` carries the fix with behavior identical to tested sources; no new runtime network/DOM dependencies, no new install mechanism.
- `userscript-release`: version-bump → CI → GitHub release flow publishes the fixed file as the GreasyFork/Tampermonkey installable asset.

## Impact

- Code: `src/ASF-STM.ts` `GetOwnCards()` declaration order; `test/` regression fixture; `package.json` patch bump.
- Distribution: unchanged Tampermonkey/GreasyFork flow — rebuild, release, update/reinstall from the release asset or GreasyFork. No alternative implementation needed.
