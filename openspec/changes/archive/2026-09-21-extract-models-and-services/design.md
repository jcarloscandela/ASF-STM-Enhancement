# Design

## Context

See `proposal.md` — Why. Observed current state (read from `src/`):

- `src/ASF-STM.ts` is ~2,536 lines and holds domain interfaces (`BotEntry`, `Badge`, `BadgeCard`, `MatchItem`, `MatchCardRef`, `ScanFilter`, `UserSettings`, `TradeParams`, `ProgressRadials`), Steam payload interfaces, storage access (`LoadConfig`/`SaveConfig`/`LoadParams`/`SaveParams`/bot cache, lines ~446–478, ~2126, ~2196), GM request handling (`fetchBots` ~2049, `updateScanFilterAppName` ~1720, `getBadgesInventory` promisification ~1624), three near-identical XHR walk blocks (`GetOwnCards` ~936, `GetCards` ~1144, `getBadges` ~1399) with repeated IIFE index capture and `errors`/`weblimiter`/`errorLimiter` backoff, plus pure helpers (`deepClone`, `getPartner`, `arrayToText`/`textToArray`, `hexToRgba`/`rgbaToHex`/`mixAlpha`, `sanitizeNickname`).
- Six Steam payload interfaces are declared twice: `src/lib/tradable.ts` and `src/lib/steam-schema.ts` both define `TradableFlag`, `SteamDescriptionLine`, `SteamItemTag`, `SteamInventoryDescription`, `SteamInventoryAsset`, `InventoryData`.
- `src/lib/matcher-core.ts` already exists (pure matching core) and declares its own `MatchCard`, `MatchBadge`, `MatchCardRef`, `MatchItem`; its `ASF-STM.ts` call-site swap is still pending in the in-flight `progressive-typescript-migration` change. `fix-settings-storage-inventory-source` plans settings-specific `loadSettings`/`saveSettings`/`resetSettings`.
- Constraints: strict TS (`strict` + `noUncheckedIndexedAccess`), rolldown bundles `src/ASF-STM.ts` + `src/lib/*.ts` into one gitignored `dist/ASF-STM.user.js`, no builder script/placeholders, tests are vitest with plain fixtures (no browser/network), no new runtime dependency, behavior must not change, and `AGENTS.md`/`README.md` plus the `package.json` patch version must be updated in the same change.

## Goals / Non-Goals

**Goals:**

- Four focused modules with one responsibility each, each independently unit-testable without a browser, each mapping to one capability in this change (`shared-models`, `storage-service`, `request-service`, `shared-helpers`).
- Exactly one declaration site for every shared model; `ASF-STM.ts` and the libs become consumers.
- Replace only the duplicated boilerplate (request resolution/promisification, retry-delay math, JSON storage, pure utilities); leave the surrounding scan orchestration intact.
- Keep `pnpm typecheck/lint/test/build` green and `dist/` a single self-contained file with no placeholders.

**Non-Goals:**

- No `matcher-core` call-site swap (owned by `progressive-typescript-migration`); this change only reconciles its duplicated type declarations.
- No settings-specific load/save/reset semantics (owned by `fix-settings-storage-inventory-source` and `settings.ts`); this change supplies only the generic JSON storage primitive.
- No conversion of the recursive XHR walks to async/await, no DOM/config-dialog redesign, no scan-mode or matching behavior change.
- No new runtime dependency and no bundler/template changes.

## Decisions

### 1. Four modules split by concern, not one `services.ts`

`models.ts` (types only), `storage.ts` (persistence), `requests.ts` (GM/HTTP + retry policy), `helpers.ts` (pure utilities). Rationale: each has a distinct testability story and blast radius, and each maps cleanly to one capability; a single services barrel would recreate the grab-bag the change is trying to remove. Alternative: one `services.ts` — rejected (mixes types, I/O, and purity; harder to test and review).

### 2. `models.ts` is type-only and erased at build

It exports only `interface`/`type` declarations (domain + Steam payload models), consumed with `import type`. Because it has no runtime code, it adds nothing to the bundle, cannot introduce runtime import cycles, and cannot change behavior; rolldown/Oxc strip it. `tradable.ts`, `steam-schema.ts`, `settings.ts`, and `matcher-core.ts` import from it instead of redeclaring. Alternative: runtime classes/enums — rejected (bundle weight, behavior risk, no benefit for structural payloads).

**Measured (task 5.2):** `dist/ASF-STM.user.js` went from **145,761 → 147,595 bytes (+1,834 B, ~+1.3%)**. Inspecting the emitted `//#region` markers shows no `models.ts` region at all — it is fully erased — so the growth is entirely `helpers.ts` + `storage.ts` + `requests.ts`, which carry the extracted runtime logic (and replace code that was already in the bundle). This is consistent with a behavior-preserving refactor rather than added functionality.

Reconciliation ordering: `matcher-core.ts`'s local `MatchCard`/`MatchBadge`/`MatchCardRef`/`MatchItem` are structurally identical to the shared models, so replacing its declarations with `import type` re-exports is behavior-neutral and compiles regardless of whether its call-site swap lands first. The task is written to run after `progressive-typescript-migration`'s swap if that swap is still pending, to avoid editing the same call sites twice.

### 3. Storage is a generic primitive over `StorageLike`

`storage.ts` exports key constants, a `StorageLike` interface (`getItem`/`setItem`/`removeItem`), and safe `readJson`/`writeJson`/`removeKey` helpers. `ASF-STM.ts` wrappers pass the real `localStorage`; tests pass an in-memory fake. Rationale: keeps vitest browser-free and lets `fix-settings-storage-inventory-source` build typed settings load/save on top without this change owning settings semantics. Alternative: put settings-specific load/save here — rejected (duplicates/steals that change's scope and couples the generic store to one domain object).

**Agreed coordination boundary with `fix-settings-storage-inventory-source`** (confirmed by re-reading both changes' artifacts):

- **This change (`storage.ts`) owns** the generic persistence primitive: the `StorageLike` interface, the raw key constants (`TempAsfStm.ASF.STM.Settings`, `.Blacklist`, `.Params`, `.BotCache` — names unchanged), and `readJson`/`writeJson`/`removeKey`. It has no opinion about any domain object.
- **`fix-settings-storage-inventory-source` owns** settings semantics: versioned key constants, `loadSettings`/`saveSettings`/`resetSettings`, merge/reset behavior, and the scan-source dispatch contract, living in `settings.ts`.
- That change should build on this primitive by importing `StorageLike` and the key constants from `storage.ts` rather than redeclaring them. If it lands first, this change's `storage.ts` absorbs its generic parts and keeps the same key names and value encodings, so persisted data needs no migration.

### 4. Requests: shared resolution, GET, and delay math — not a full retry orchestrator

`requests.ts` exports (a) request-function resolution preferring modern `GM.xmlHttpRequest` over legacy `GM_xmlhttpRequest` and failing clearly when neither exists, (b) a promise-returning GET that rejects with the HTTP status and on transport error/timeout, and (c) a pure `retryDelay` calculator for the existing `weblimiter + errorLimiter * errors` formula plus the max-error stop condition. The three recursive XHR walks keep their shape and call the shared pieces. Rationale: the walks are stateful, guard-heavy, and order-sensitive; rewriting them into a generic retry loop is the main behavior-drift risk for no functional gain. Alternative: one `requestWithRetry` used by all walks — rejected as behavior-risky and larger than the duplication it removes.

### 5. Helpers are pure; fallback diagnostics are injected

`helpers.ts` moves `getPartner`, `arrayToText`/`textToArray`, `hexToRgba`/`rgbaToHex`/`mixAlpha`, `sanitizeNickname`, and `deepClone` verbatim. The two color helpers currently call `debugPrint` on a parse fallback; to keep the module host-free they accept an optional logger callback (default no-op) and the `ASF-STM.ts` wrappers pass the existing debug printer. Rationale: preserves the debug messages while keeping the spec's no-host-side-effects guarantee; the spec's fallback results are unchanged. Alternative: drop the diagnostics — rejected (behavior change in debug builds).

### 6. Testing strategy stays fixture-based

New suites: `test/storage.test.ts` (round-trip, missing/corrupt fallback, remove), `test/helpers.test.ts` (color fallbacks, sanitization, list/text, clone independence), `test/requests.test.ts` (mechanism selection injected as fakes, success/error/timeout rejection, `retryDelay` values and max-error stop). Existing suites (`tradable`, `steam-schema`, `settings`, `matcher-core`, `scanner-config`) stay green after the model move; no real network, GM, or timer is used.

## Risks / Trade-offs

- [Behavior drift while moving code] → Move code verbatim with no logic edits; keep all existing suites green; only remove duplication, never rewrite algorithms.
- [Type-only module erasure assumption] → Use `import type` everywhere in `models.ts` consumers; verify `pnpm typecheck` and `pnpm build` and inspect `dist/ASF-STM.user.js` for no stray references and no `{{PLACEHOLDER}}` tokens.
- [Editing `matcher-core.ts` while its extraction is in flight] → Reconcile its type declarations only after the pending call-site swap, keep shapes structurally identical so either order compiles; if the swap is still pending, defer that one task and note it.
- [Storage scope collides with `fix-settings-storage-inventory-source`] → This change provides only the generic `StorageLike`/JSON primitive; settings load/save/reset semantics stay with that change/`settings.ts`. Sequence after it if both touch `LoadConfig`/`SaveConfig`.
- [Bundle or strictness regressions] → No new dependency; new modules are small and type-only where possible; CI already gates typecheck/lint/test/build.
- [Debug logging lost during extraction] → Inject the logger for color-fallback diagnostics so debug output is unchanged.

## Migration Plan

Slices land independently, each bumping the `package.json` patch per the AGENTS.md versioning rule:

1. `models.ts` + re-point `tradable`/`steam-schema`/`settings` (+ `matcher-core` when safe) and keep all suites green.
2. `helpers.ts` + suite + rewire the `ASF-STM.ts` helper call sites.
3. `storage.ts` + suite + rewire settings/blacklist/params/bot-cache persistence.
4. `requests.ts` + suite + rewire request resolution, promisified GET, and retry delays.
5. Wrapper cleanup, docs sync (`AGENTS.md`/`README.md` lib list), full verification (`typecheck`, `lint`, `test`, `build`, single file, no placeholders).

Rollback per slice: revert the slice commit; `dist/` is regenerated and never committed, and persistence keys/values are unchanged so there is no data migration.

## Open Questions

None.
