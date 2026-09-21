# Proposal

## Why

`src/ASF-STM.ts` is still a ~2,500-line / 97 KB monolith that mixes domain models, storage access, GM/HTTP request handling, retry/backoff orchestration, pure utilities, DOM glue, and the trade-offer page script. The same interfaces are declared in three places (`ASF-STM.ts`, `tradable.ts`, `steam-schema.ts` — e.g. `SteamInventoryDescription`, `InventoryData`, `TradableFlag`, `MatchItem`), and request/storage boilerplate is copied across every scan flow, so a payload-shape or storage-key change has to be repeated in several files and drifts silently.

## What Changes

- Add `src/lib/models.ts`: canonical exported model module for the app's domain and Steam payload shapes (`Badge`, `BadgeCard`, `MatchItem`, `MatchCardRef`, `ScanFilter`, `UserSettings`, `TradeParams`, `ProgressRadials`, `SteamInventoryDescription`, `SteamInventoryAsset`, `InventoryData`, `BadgeCardInfo`, `BotEntry`, `TradableFlag`, …). `tradable.ts`, `steam-schema.ts`, `settings.ts`, and `matcher-core.ts` stop declaring their own copies and reference the shared declarations, so every type has exactly one definition.
- Add `src/lib/storage.ts`: typed `localStorage` JSON persistence service (safe read with fallback, write, remove, key constants, injectable `StorageLike`) used for settings, blacklist, params, and bot cache.
- Add `src/lib/requests.ts`: reusable GM request service (resolve `GM_xmlhttpRequest` vs `GM.xmlHttpRequest`, promisified GET with JSON/HTML handling, shared error/timeout handling) plus the retry/backoff scheduler that the three XHR walks and the bot fetch currently duplicate.
- Add `src/lib/helpers.ts`: pure helpers extracted verbatim (`hexToRgba`/`rgbaToHex`/`mixAlpha`, `sanitizeNickname`, `arrayToText`/`textToArray`, `deepClone`).
- Rewire `src/ASF-STM.ts` call sites to thin wrappers over the new modules; no scan, matching, config, or trade-offer behavior changes.
- Add vitest suites with plain fixtures (no browser, no network) for storage, helpers, and request scheduling; keep `tradable`/`steam-schema`/`settings`/`matcher-core` suites green after the model move.
- Coordination, not re-implementation: the in-flight `progressive-typescript-migration` change keeps ownership of the `matcher-core` call-site swap; `fix-settings-storage-inventory-source` keeps ownership of settings-specific load/save/reset semantics (this change only provides the generic JSON storage primitive they can build on).

## Capabilities

### New Capabilities

- `shared-models`: single canonical TypeScript model module for domain and Steam payload shapes, so consumers import one declaration instead of re-declaring interfaces per file.
- `storage-service`: typed, injectable JSON persistence helper over a `StorageLike`, giving every persist/load call safe parsing and one set of storage keys.
- `request-service`: reusable GM/HTTP request helper providing request-function resolution, promisified GET, and the shared retry/backoff scheduling used by the scan walks.
- `shared-helpers`: pure, side-effect-free utility functions (color conversion, nickname sanitization, list/text conversion, deep clone) with unchanged behavior.

### Modified Capabilities

<!-- None: this is a behavior-preserving refactor; no existing spec requirement changes. -->

## Impact

- Code: new `src/lib/models.ts`, `storage.ts`, `requests.ts`, `helpers.ts`; modified `src/ASF-STM.ts` (thin wrappers, duplicate declarations removed), `src/lib/tradable.ts`, `src/lib/steam-schema.ts`, `src/lib/settings.ts`, and `src/lib/matcher-core.ts` (reference shared models); `rolldown.config.ts` unchanged (new libs bundle via normal imports); `tsconfig.json` unchanged.
- Tests: new `test/storage.test.ts`, `test/helpers.test.ts`, `test/requests.test.ts`; existing suites updated only for moved type imports.
- Docs/version: `AGENTS.md` and `README.md` lib list updated; `package.json` patch bumped per the repo versioning rule.
- Systems: `pnpm typecheck/lint/test/build` and CI unchanged in shape; `dist/` stays a single gitignored self-contained file.
- Non-goals: no user-visible behavior change, no DOM/config-dialog or scan-orchestration redesign, no new runtime dependency.
