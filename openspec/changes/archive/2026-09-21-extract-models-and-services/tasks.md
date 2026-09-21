# Tasks

## 1. Shared models module (`shared-models` spec)

- [x] 1.1 Create `src/lib/models.ts` exporting the domain models (`Badge`, `BadgeCard`, `MatchItem`, `MatchCardRef`, `ScanFilter`, `UserSettings`, `TradeParams`, `ProgressRadials`) and Steam payload models (`TradableFlag`, `SteamDescriptionLine`, `SteamItemTag`, `SteamInventoryDescription`, `SteamInventoryAsset`, `InventoryData`, `BadgeCardInfo`, `BotEntry`) as type-only declarations moved verbatim from `src/ASF-STM.ts`, `src/lib/tradable.ts`, and `src/lib/steam-schema.ts`, and verify `pnpm typecheck` passes
- [x] 1.2 Re-point `src/lib/tradable.ts` and `src/lib/steam-schema.ts` to `import type` from `src/lib/models.ts`, remove their duplicate interface declarations, and verify `pnpm test` passes with the existing `tradable`/`steam-schema` suites unchanged
- [x] 1.3 Re-point `src/lib/settings.ts` (`ScanFilterEntry`) and `src/ASF-STM.ts` consumers to the shared models, remove the local duplicate declarations, and verify `pnpm typecheck` and `pnpm test` pass
- [x] 1.4 Reconcile `src/lib/matcher-core.ts` to import `MatchCard`/`MatchBadge`/`MatchCardRef`/`MatchItem` from the shared models instead of declaring them locally, after the `progressive-typescript-migration` call-site swap has landed or while keeping the shapes structurally identical, and verify `pnpm test` passes for `test/matcher-core.test.ts`
- [x] 1.5 Verify no shared model has a competing declaration by searching `src/` for each model name and confirming a single declaration site, and verify `pnpm build` emits `dist/ASF-STM.user.js`

## 2. Pure helpers service (`shared-helpers` spec)

- [x] 2.1 Create `src/lib/helpers.ts` with `getPartner`, `arrayToText`, `textToArray`, `hexToRgba`, `rgbaToHex`, `mixAlpha`, `sanitizeNickname`, and `deepClone` moved verbatim from `src/ASF-STM.ts`, with an optional injected logger for the existing color-fallback diagnostics, and verify `pnpm typecheck` passes
- [x] 2.2 Add `test/helpers.test.ts` covering color fallbacks and conversions, nickname escaping, list/text conversion with non-numeric filtering, and clone independence, and verify `pnpm test` passes
- [x] 2.3 Swap the `src/ASF-STM.ts` call sites (`ShowConfigDialog`, blacklist text, params persistence, `compareCards` clones) to the helper wrappers and verify `pnpm typecheck` and `pnpm lint` pass

## 3. Storage service (`storage-service` spec)

- [x] 3.1 Confirm the coordination boundary with `fix-settings-storage-inventory-source` (generic storage primitive here, settings load/save/reset semantics stay there) and record the agreed split in `design.md`, verified by re-reading the two changes' artifacts
- [x] 3.2 Create `src/lib/storage.ts` with a `StorageLike` interface, the declared key constants for settings/blacklist/params/bot-cache, and safe `readJson`/`writeJson`/`removeKey` helpers, and verify `pnpm typecheck` passes
- [x] 3.3 Add `test/storage.test.ts` with an in-memory fake storage covering write/read round-trip, missing-key fallback, corrupt-JSON fallback, and remove-restores-fallback, and verify `pnpm test` passes
- [x] 3.4 Rewire `LoadConfig`/`SaveConfig`/`LoadParams`/`SaveParams` and the bot-cache read/write in `src/ASF-STM.ts` to the storage service (passing real `localStorage`) and verify `pnpm test` and `pnpm typecheck` pass

## 4. Request service (`request-service` spec)

- [x] 4.1 Create `src/lib/requests.ts` with request-mechanism resolution (modern `GM.xmlHttpRequest` preferred, legacy `GM_xmlhttpRequest` fallback, clear error when neither exists) and a promise-returning GET that rejects with the HTTP status or on transport error/timeout, and verify `pnpm typecheck` passes
- [x] 4.2 Add the pure retry-delay calculation and max-error stop condition to `src/lib/requests.ts` and add `test/requests.test.ts` with injected fake request functions covering mechanism selection, success/error/timeout rejection, base and increasing delays, and the max-error stop, and verify `pnpm test` passes
- [x] 4.3 Rewire `fetchBots`, `updateScanFilterAppName`, and the `getBadgesInventory` promisification in `src/ASF-STM.ts` to the shared request resolution/GET, and replace the duplicated `weblimiter + errorLimiter * errors` delay math in `GetOwnCards`, `GetCards`, and `getBadges` with the shared calculator, and verify `pnpm typecheck` and `pnpm lint` pass
- [x] 4.4 Verify the recursive scan flows still honor stop/supersede behavior and the max-error stop by inspecting every changed call site against the pre-change behavior, and verify the existing suites still pass with `pnpm test`

## 5. Final verification, docs, and release hygiene

- [x] 5.1 Run full verification (`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`) and verify `dist/ASF-STM.user.js` exists as a single self-contained file with the current version string and no `{{PLACEHOLDER}}` tokens
- [x] 5.2 Confirm the four new modules add no runtime bundle weight where type-only (`models.ts` erased) and record the measured `dist/` size delta in `design.md`, verified by comparing the built file size before and after
- [x] 5.3 Sync docs (`AGENTS.md` and `README.md` lib list, layout, and commands), bump the `package.json` patch version, and verify `pnpm format:check` passes
