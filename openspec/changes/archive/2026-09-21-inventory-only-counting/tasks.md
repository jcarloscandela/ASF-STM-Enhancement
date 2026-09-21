# Tasks

## 1. Settings model and dispatch

- [x] 1.1 In `src/lib/settings.ts`: reduce `ScanPlan` to `mode: "filters" | "inventory"` (drop the `inventoryScan` flag), and rewrite `resolveScanPlan` to return `filters` when enabled with at least one active filter, otherwise always `inventory`; verify with `pnpm typecheck`
- [x] 1.2 In `src/lib/settings.ts`: remove `inventoryScan` from the settings schema key list and from every doc comment that references the flag; verify with `pnpm typecheck && pnpm lint`
- [x] 1.3 In `src/lib/models.ts`: remove `inventoryScan` from `GlobalSettings` (keep `inventoryScanDelay`); verify with `pnpm typecheck`
- [x] 1.4 Update `test/settings.test.ts`: rewrite the `resolveScanPlan` suite to the two-mode model (filters precedence, inventory as unconditional default, missing/corrupt settings still route to inventory), update `resolveScanRoute` fixtures (no `badge` mode), and update store round-trip tests that asserted badge dispatch to assert inventory dispatch with a legacy `inventoryScan` key ignored; verify with `pnpm test`

## 2. Scanner flow

- [x] 2.1 In `src/ASF-STM.ts`: remove the badge-page crawl `getBadges` and all badge-mode branches in `prepareInventoryScan`, `buttonPressedEvent`, and `getBadgesInventory` (inventory fetch → badges-database eligibility is now the unconditional non-filter flow); verify with `pnpm typecheck`
- [x] 2.2 In `src/ASF-STM.ts`: update the three `abortInventoryScan` messages that suggest "disable inventory scan to use badge pages" to suggest retrying instead, and simplify the scan-plan debug print (no `badge` mode / no `inventoryScan` flag); verify by grepping for `getBadges` / `badge"` returning no scan-path matches
- [x] 2.3 Confirm `fetchInventory`, `getBadgesInventory`, `GetOwnCards`, and the per-card owned-count fallback in the eligibility builder are untouched by the removal; verify with `pnpm test` and a read-through of the changed call sites

## 3. Config dialog

- [x] 3.1 In `src/templates/configDialogTemplate.ts`: remove the "Scan inventory" checkbox row and the `inventoryScan` field from `ConfigDialogSettings`, keep the "Inventory scan delay (ms)" input, and fix the grid row numbering; verify with `pnpm typecheck` and visual check of the rendered dialog HTML in the built userscript
- [x] 3.2 In `src/ASF-STM.ts` `ShowConfigDialog` save handler: remove the `#inventoryScan` read/write so the dialog-save flow never persists the flag; verify with `pnpm typecheck`

## 4. Defaults, docs, and release

- [x] 4.1 In `src/ASF-STM.ts` defaults object: remove the `inventoryScan: false` default (keep `inventoryScanDelay: 3000`); verify reset still restores the remaining defaults via `pnpm test`
- [x] 4.2 Update `README.md` and `AGENTS.md` wherever the badge-page scan mode or the "Scan inventory" option is described (docs-sync rule); verify by grepping both files for "badge-page scan" / "Scan inventory" with no stale references remaining
- [x] 4.3 Bump the package version in `package.json` (patch minimum) and run the full gate: `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm build`; verify `dist/ASF-STM.user.js` builds with no unreplaced placeholders and no `// DEBUG` markers
