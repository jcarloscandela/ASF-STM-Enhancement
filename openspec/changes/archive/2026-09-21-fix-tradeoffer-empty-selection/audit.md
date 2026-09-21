# Audit note: old-vs-new trade path (tasks 1.1-1.3)

Compared `C:\Users\jccan\Desktop\Projects\ASF-STM-Enhancement\src\ASF-STM.js`
(old, working) with `src/ASF-STM.ts` (new) across the full trade path.

## 1.1 Match-row URL builders — NO DIVERGENCE

Both build the identical contract:

- friend mode: `?partner=<full SteamID>&source=asfstm` (no token)
- bot mode: `?partner=<truncated account id>&token=<token>&source=asfstm`
- per badge: `&match=<appid>`; bulk: `&match=all`

The user's example URL (`partner=326065081&token=icjGVoAf&source=asfstm&match=all`)
is the bot-mode form and parses correctly. No fix needed here.

## 1.2 Params persistence — NO DIVERGENCE (new is stricter)

- Old `SaveParams` snapshots `cardNames` only when undefined; `storeMatches`
  uses `indexOf`, so a hash added after the snapshot persists as `-1`.
- New `storeMatches` materializes the table first and `buildMatchStore`
  appends unknown hashes (never `-1`), syncing the set back. Safe superset.

## 1.3 Trade-page parsing — DIVERGENCES FOUND AND FIXED

1. **Partner-key coverage was incomplete.** Old accepted only the exact stored
   key (`params.matches[vars.partner]`); new already added the truncated
   fallback, and this change adds the twice-truncated candidate too
   (`tradePartnerKeyCandidates` / `resolvePartnerMatches`), so bot-mode and
   friend-mode URLs both resolve regardless of which id form was stored.
2. **Dead `match` validation.** Both carried the inherited
   `Number(vars.match) === NaN` check (never true). Fixed with
   `Number.isNaN` in `resolveTradeFilter`: `match=abc` now aborts loudly
   with "invalid url parameter" instead of pushing `NaN` into the filter
   (which resolved zero cards silently).
3. **Silent selection failures.** The `checkContexts` catch around `addCards`
   only wrote the debug log. It now also shows the "ASF-STM trade setup
   failed" dialog naming `TempAsfStm.ASF.STM.Params`, matching the existing
   handoff-error dialog. Every abort (bad partner, bad match, empty Cards,
   unbalanced sides, missing inventory items) is now user-visible.

## Selection loop (`addCards`) — NO DIVERGENCE except intended tradable skip

Name matching (`market_hash_name`), SORT/RANDOM order, `MoveItemToTrade`,
missing-items and not-1:1 aborts are identical. The only addition is
skipping trade-held / future-"Tradable After" copies per the trade-matching
spec, falling through to the existing missing-items abort.

## Test params for the remaining URL parts

- `partner`: selects the match entry (raw, truncated, or twice-truncated).
- `token`: pass-through to Steam, untouched by the script.
- `source=asfstm`: gates the auto-fill; without it the page behaves as stock.
- `match`: `all` = every filtered badge, `<appid>` = exactly one badge.
- Diagnose via localStorage `TempAsfStm.ASF.STM.Params`
  (`matches` / `filter` / `cardNames`) plus the debug log (tried keys, filter).
