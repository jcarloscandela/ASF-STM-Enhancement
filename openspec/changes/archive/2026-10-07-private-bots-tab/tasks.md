# Tasks

## 1. Private-bots store lib

- [x] 1.1 Create `src/lib/private-bots.ts` with record types plus pure `read/private-bots`, `write`, `upsert` (first-seen kept, last-seen advanced, snapshot fill), `remove`, and `needsBackfill` helpers on an injected storage-like interface, and verify `pnpm test test/private-bots.test.ts` passes with fixture coverage for upsert/remove/corrupt-version tolerance.
- [x] 1.2 Add `privateBots: "TempAsfStm.ASF.STM.PrivateBots.v1"` to `STORAGE_KEYS` in `src/lib/storage.ts` and verify `pnpm typecheck` plus existing storage tests pass.

## 2. Scan capture wiring

- [x] 2.1 Call `upsertPrivateBot` at the existing bot-mode auto-blacklist branch in `src/ASF-STM.ts` (`GetCards` missing-card-section path) using the in-memory `BotEntry` snapshot, bot-mode only, and verify with a scan-fixture test that a private bot yields both a blacklist entry and a metadata entry with no duplicate on re-capture.
- [x] 2.2 Load the private record at config-open time alongside `LoadConfig()` and verify the dialog receives the current entries in a happy-dom wiring test.

## 3. Config Private bots tab

- [x] 3.1 Add tab6 `Private bots` markup plus row renderer to `src/templates/configDialogTemplate.ts` (avatar link to `https://steamcommunity.com/profiles/{SteamID}` opening in a new tab, nickname-or-ID fallback, item count, per-row `Limpiar` with `data-steamid`) and verify rendered HTML contains profile links and clean buttons for fixture entries plus an empty state.
- [x] 3.2 Wire delegated `Limpiar` handler in `src/ASF-STM.ts` config code that removes the metadata entry, filters the SteamID out of `blacklist`, persists both via `SaveConfig()` path, and re-renders the tab body without requiring dialog Save, and verify with a happy-dom test that one click clears both stores.
- [x] 3.3 Implement cache-first lazy backfill for entries missing nickname/avatar when the tab opens (bot cache first, then serial same-origin profile fetch honoring `weblimiter`, per-row fallback on failure) and verify unresolved rows render the SteamID fallback and a failed fetch never blocks other rows.

## 4. Quality gates and docs

- [x] 4.1 Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build` and verify all pass with no new warnings.
- [x] 4.2 Bump `package.json` patch version and update `AGENTS.md` and/or `README.md` for the new tab and store per the docs-sync rule, and verify `git diff --stat` shows version, docs, `src/`, `test/`, and `openspec/` changes only.
