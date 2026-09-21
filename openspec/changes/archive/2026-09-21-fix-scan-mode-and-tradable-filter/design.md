# Design

## Context

See proposal.md for motivation. Current state (observed in `src/`):

- Settings persist via `LoadConfig`/`SaveConfig` in `src/ASF-STM.js` using `localStorage` key `TempAsfStm.ASF.STM.Settings`. `LoadConfig` merges defaults, but the merge line reads `globalSettings[key] = defaultSettings[defaultSettings]` (evaluates to `undefined`) instead of `defaultSettings[key]`, so any key missing from stored settings becomes `undefined` (falsy) rather than its default.
- Scan entry is `buttonPressedEvent`. On a cold/expired bot cache it calls `fetchBots()` and returns; `fetchBots` on success re-invokes `buttonPressedEvent`. The actual scan always starts with `prepareInventoryScan(runId)`, which fetches the Steam inventory (for tradability) and then branches: `inventoryScan && inventoryData !== null` → `getBadgesInventory` (badges DB + `buildScanEligibility`), else `getBadges(1)` (badge pages). `getBadgesInventory`/`getBadges` both honor `processFilters` first. `GetOwnCards` applies `resolveOwnedCount(tradableCardCounts, ...)` per card.
- Tradability today is `isTradableDescription` in `src/lib/tradable.js`: `tradable !== false && !== 0 && !== "0"`. `market_tradable_restriction` is deliberately ignored. Unit tests in `test/tradable.test.js` cover exactly that predicate plus counts/eligibility. Nothing parses a "Tradable After" timestamp.
- Trade-offer creation runs on the `tradeoffer/new` page: `addCards` matches requested `market_hash_name` values against live `rgInventory` entries and moves the first match per card into the trade with no tradability check.

## Goals / Non-Goals

**Goals:**
- Persisted scan mode fully determines the executed path, including the cold-cache first click; stored `inventoryScan=true` survives across days and missing-key merges.
- Time-gated holds ("Tradable After" in the future) are treated as non-tradable in counting, eligibility, matching, and offer creation.
- No silent mode switches: any designed fallback (inventory→badge pages) stays observable in the debug log/status.

**Non-Goals:**
- Matching foils or non-card item classes; changing bot sorting, filters UI, or the badges database schema.
- Rewriting the scan pipeline (XHR chains, rate limiting, progress radials) beyond the branching/persistence fixes.

## Decisions

1. **Fix `LoadConfig` merge to `defaultSettings[key]` and guard stored-shape upgrades.**
   Rationale: one-line root cause for settings that "reset" after an update or partial store; preserves stored `true` values. Alternative (versioned settings migration) rejected as overkill — a correct key-wise fill plus existing `ResetConfig` path is sufficient.

2. **Pin scan-mode branching on a snapshot of settings taken at click time and threaded through the cold-cache refetch.**
   Rationale: guarantees the button state the user sees is the behavior they get even when the first click only refetches bots. Alternative (re-reading `globalSettings` late) risks TOCTOU if the user opens config mid-fetch; a snapshot is deterministic. Keep `processFilters` precedence but document it so "inventory on + active scan filters → filter path (still tradability-filtered)" is not reported as a mode bug.

3. **Extend the tradability predicate to time-based holds, with `tradable` flag still authoritative for hard holds.**
   Approach: capture the real inventory payload for the reported Alyx Vance card (description + asset JSON and the trade-page `rgInventory` entry), then accept whatever Steam actually sends for "Tradable After" (candidate fields: date-time strings, epoch seconds/ms, per-asset flags). Rule: future timestamp → non-tradable; past/missing/unparseable timestamp → fall back to the existing `tradable`-flag verdict (fail-open, per the existing "missing field = tradable" contract). `market_tradable_restriction` (fixed post-market cooldown count) stays ignored unless the captured payload proves it carries the hold date.
   Alternative (client clock + fixed 7/15-day assumption) rejected — Steam shows an explicit per-item date; compute against it.

4. **Apply the same predicate in both card-picking sites.**
   - Scan side: `buildTradableCardCounts` (and therefore `resolveOwnedCount`/`buildScanEligibility`) automatically inherits the fix.
   - Offer side: `addCards` filters live `rgInventory` candidates per `market_hash_name` to currently-tradable copies before `MoveItemToTrade`; fully-held requests hit the existing missing-items abort. Alternative (relying on Steam to hide held items) rejected — the bug report proves held copies are selectable.

5. **Tests stay dependency-free (`node --test test/`).**
   Add fixtures mirroring the captured Steam payload: future-dated hold excluded, past-dated hold included, unparseable/missing date falls back to flag, flag-false still wins, plus a `LoadConfig`-merge round-trip test (stored `inventoryScan:true` + missing new keys → preserved + defaulted) and a scan-branch test if the harness can import the branching helper without a browser (otherwise cover branching by code review + manual matrix).

## Risks / Trade-offs

- [Risk] Steam uses different field names/formats for "Tradable After" across inventory vs. trade-page payloads → Mitigation: capture both payloads from the reporter's account before coding the predicate; unit fixtures use verbatim shapes.
- [Risk] Client clock skew misclassifies near-boundary dates → Mitigation: compare with a small grace (e.g. treat "after now" strictly; log the parsed date in debug builds so boundary cases are diagnosable).
- [Risk] Stricter filtering reduces match counts (users see fewer offers) → Mitigation: expected and correct — offers Steam would drop are worse; debug log already reports excluded counts.
- [Risk] Fallback inventory→badge path looks like a "mode switch" → Mitigation: keep fallback but log/status it explicitly; never silently swap modes on success paths.

## Migration Plan

No data migration. Ship as a userscript version bump; users keep existing `localStorage` settings (merge fix heals partial stores on next load). Rollback is the previous `dist/` build. Release steps (version bump, commit, push, GitHub release) run in the apply phase after tests and build pass.

## Open Questions

None — the one field-name unknown (exact "Tradable After" payload shape) is a defined first implementation task (capture fixture), not a spec/design fork.
