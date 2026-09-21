# Tasks

## 1. Reproduce and route audit

- [x] 1.1 Trace inventory-mode flow (`buttonPressedEvent` → `prepareInventoryScan` → `getBadgesInventory` → `GetOwnCards`) and list every call site that can reach `getBadges` from inventory mode; verify by code inspection against `src/ASF-STM.ts` and `src/lib/settings.ts`
- [x] 1.2 Add regression tests proving inventory mode issues no badge-page requests and aborts explicitly on inventory/DB/tradability failure (vitest fixtures, no browser/network); verify with `pnpm test`

## 2. Fix inventory-mode routing

- [x] 2.1 Gate candidate discovery strictly on snapshotted `scanPlan.mode` so inventory mode never calls `getBadges`; verify new routing tests pass
- [x] 2.2 Replace silent `getBadges(1, scanPlan)` fallback in `getBadgesInventory` with explicit abort (`stopEventCleanup` + UI message + `debugPrint`); verify abort path in tests and no badge fetch occurs
- [x] 2.3 Keep `filters`-mode precedence and badges-mode flow unchanged; verify existing `test/settings.test.ts` and `test/tradable.test.ts` suites still pass

## 3. Verify and release hygiene

- [x] 3.1 Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` and verify the single `dist/` file contains no `{{PLACEHOLDER}}`; fix issues until green
- [x] 3.2 Bump `package.json` patch version per repo versioning rule and verify the userscript header picks it up in the build
