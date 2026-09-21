# Proposal

## Why

"Offer a trade for all" (`match=all`) and per-badge "Offer a trade" (`match=<appid>`) open the Steam trade-offer page with `source=asfstm` but select zero items on both sides, with no visible error and no cards rendered. The most likely causes are a broken scan→offer handoff (persisted `matches`/`filter`/`cardNames` key mismatch, e.g. truncated partner id vs full SteamID; `cardNames` id→name decode failure), plus a silent failure in the offer-page item-selection flow (`checkContexts`/`MoveItem` never matching live inventory descriptions).

## What Changes

- Audit new project (`steam-cards/ASF-STM-Enhancement`) against old project (`ASF-STM-Enhancement`) across the full trade path: match-row URL building, `storeMatches`/`SaveParams`/`LoadParams` persistence, trade-page param parsing (`partner`, `match`), card-name id resolution, `Cards[2]` construction, and `checkContexts`/inventory-selection loop.
- Fix the `match=all` path so it selects every matchable trade (all appids in `params.filter` ∩ `params.matches[partner]`), and the per-badge path so it selects exactly that badge's send/receive cards.
- Make failures loud: surface missing-matches, unknown-card-id, empty-Cards, and missing-inventory-item aborts in the UI (existing alert dialog) instead of silently selecting nothing; document how to test remaining URL params (`partner`, `token`, `source`, `match`) via localStorage key `TempAsfStm.ASF.STM.Params`.
- Add fixture coverage for the handoff (URL→filter→Cards resolution) and the old-vs-new behavioral diff.

## Capabilities

### New Capabilities

- `trade-offer-handoff`: scan→tradeoffer URL contract and offer-page item selection for `match=all` and `match=<appid>`, including partner-key resolution, card-name decoding, Cards construction, tradable-only selection, and loud abort/diagnostics.

### Modified Capabilities

- none (existing `trade-matching` / `scan-lifecycle` requirements already cover tradable-only selection and loud aborts; this change adds the handoff contract without altering them).

## Impact

- `src/ASF-STM.ts` (match-row URL builders ~L479-546, `storeMatches`/`SaveParams`/`LoadParams`, trade-page block ~L2162-2270, `checkContexts`/selection helpers, `getPartner`), `src/lib/*` (matcher-core, storage, helpers), `src/templates/*` (row/match buttons), persisted `TempAsfStm.ASF.STM.Params` shape; no dependency changes.
