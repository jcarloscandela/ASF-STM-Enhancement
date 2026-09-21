# Design

## Context

The scanner dispatches three scan paths from `resolveScanPlan` (`src/lib/settings.ts`): `filters` (scan filters enabled with at least one active filter), `inventory` (persisted `inventoryScan=true`), and `badge` (fallback). The badge path (`getBadges` in `src/ASF-STM.ts`) crawls the user's badge pages and derives owned-card data from page HTML; the inventory path fetches the paged Steam inventory API (`fetchInventory`), computes tradable counts (`buildTradableCardCounts` in `src/lib/tradable.ts`), and derives badge eligibility from the badges database (`getBadgesInventory`). The config dialog exposes a "Scan inventory" checkbox plus an "Inventory scan delay (ms)" input. The inventory path already aborts visibly on failure instead of silently degrading (see `tradable-card-filter` spec).

## Goals / Non-Goals

**Goals:**

- One non-filter scan path: `resolveScanPlan` returns `filters` or `inventory`, nothing else.
- Remove the "Scan inventory" checkbox from the config dialog; the inventory scan delay input stays.
- Keep the inventory-scan failure behavior (visible abort with retry suggestion) and refresh its messages, which currently advertise disabling inventory scan.
- Existing users' other settings survive the upgrade untouched.

**Non-Goals:**

- No changes to matching, tradability rules, or the badges-database eligibility logic.
- No storage migration: a stored `inventoryScan` key is simply ignored, not deleted or rewritten.
- No change to scan-filter behavior, precedence, or management UI.

## Decisions

**1. Delete the badge-page code path rather than hide it behind a hidden setting.**
`getBadges` and the `badge` plan mode go away entirely. Rationale: dead paths rot and still cost test surface; the abort-on-failure behavior of the inventory path already covers the reliability concern that justified keeping a fallback. Alternative considered: keeping `getBadges` as an emergency fallback triggered by a debug flag — rejected because it preserves the two-mode dispatch complexity this change exists to remove.

**2. Remove the `inventoryScan` key from `GlobalSettings`, the settings schema, and `ScanPlan`, but not from storage.**
The persisted blob keeps any legacy `inventoryScan` value; it is never read for dispatch and never re-saved by the dialog handler. `mergeWithDefaults` only merges keys present in the defaults object, so once the key leaves the defaults, a stored value is ignored naturally — no migration code. Alternative considered: actively stripping the key on load — rejected as unnecessary churn for the same observable behavior.

**3. Keep the badge-page `owned` counts semantics where they are still meaningful.**
`GetOwnCards` (per-badge card details via `ajaxgetbadgeinfo`) stays: the inventory path needs owned counts per card for set progress and requests, and per-card fallback when a game is missing from the tradability lookup. Only the badge-*page crawl* used to discover badges is removed; badge discovery in inventory mode comes from the badges database (`buildScanEligibility`).

**4. Update abort messages to match the new reality.**
`abortInventoryScan` messages currently say "disable inventory scan to use badge pages" (three call sites). New text: suggest retrying later; no mode-switch escape hatch exists.

**5. Config dialog layout.**
Removing the checkbox row leaves the delay input in the same grid; renumber the grid rows so the delay input keeps its position. `ConfigDialogSettings` and the dialog-save handler in `ShowConfigDialog` drop the `inventoryScan` field.

## Risks / Trade-offs

- [Users who preferred badge pages lose that option] → Mitigation: accepted per the change's purpose; inventory mode is faster and its failure mode is a visible, retryable error rather than a silent stall.
- [A user with an unreliable inventory (private inventory, Steam hiccup) cannot scan at all] → Mitigation: abort message suggests retrying; scan filters remain available as a way to scan a known subset without inventory discovery.
- [Legacy stored `inventoryScan: true/false` lingers in storage forever] → Mitigation: harmless — never read, never re-saved; no user-visible effect.
- [Tests asserting three-mode dispatch break] → Mitigation: planned rewrite of `test/settings.test.ts` scan-plan/route suites to the two-mode model is part of the task list, not an afterthought.

## Migration Plan

1. Land the code change (settings model, dispatch, dialog, abort messages, tests) in one commit; bump the package version (patch minimum) per repo rules.
2. No data migration; storage keys and other settings are untouched.
3. Rollback: revert the commit — stored settings are forward- and backward-compatible because the `inventoryScan` key is ignored, not deleted.

## Open Questions

None — the removal scope is unambiguous from the proposal.
