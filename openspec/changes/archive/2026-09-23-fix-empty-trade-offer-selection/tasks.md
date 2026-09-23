# Tasks

## 1. Handoff diagnosis (pure lib)

- [x] 1.1 Extend handoff resolvers in `src/lib/matcher-core.ts` to expose a diagnosis payload (partner-key candidates tried, resolved appid filter, per-appid match presence, skipped unknown card ids, `Cards[2]` counts) and verify with new vitest fixtures for unknown-partner, `match=all` with no overlap, all-ids-unknown, and unbalanced-sides cases.
- [x] 1.2 Extend live-selection reporting in `src/lib/offer-writer.ts` so a fully-unsupplied plan carries per-card side + absent-vs-unselectable entries with the existing cap pattern, and verify with a fully-held-pool fixture asserting `failLater`, shortfall entries, and zero planned moves.

## 2. Trade-page wiring

- [x] 2.1 Update the trade-offer handoff `try/catch` in `src/ASF-STM.ts` to render the `trade setup` dialog with stage label, diagnosis counts, explicit "No items were added." sentence, and the `TempAsfStm.ASF.STM.Params` pointer, and verify via the offer-harness pattern with canned documents and faked XHR seams (no browser/network).
- [x] 2.2 Update `addCards`/`checkContexts` shortfall, slot-mismatch, and non-1:1 paths to use the `live inventory` dialog (per-card lines, no Params blame, explicit empty-offer sentence) while preserving zero-moves atomicity, and verify with harness tests asserting zero `MoveItemToTrade` calls on each abort.

## 3. Verification and release hygiene

- [x] 3.1 Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build` and verify all pass with no unreplaced placeholders or debug markers.
- [x] 3.2 Bump `package.json` version (patch minimum) and sync `AGENTS.md` and/or `README.md` per the docs-sync rule, and verify with `openspec validate --change fix-empty-trade-offer-selection`.
