# Design

## Context

See proposal.md Why. Scan page (`src/ASF-STM.ts` ~L479-546: URL builders; ~L604-612 `storeMatches`; `SaveParams`/`LoadParams`) hands off to the Steam tradeoffer page block (~L2162-2270: `source=asfstm` gate, `getUrlVars`, `params.matches[partnerKey]`, `filter`, `Cards[2]`, `checkContexts`). Suspects: partner-key mismatch (truncated vs full SteamID), `cardNames` not materialized before save, `filter` empty/stale, `match` parsing, `checkContexts`/inventory-description matching silently finding nothing. Old project at `C:\Users\jccan\Desktop\Projects\ASF-STM-Enhancement` is the behavioral oracle.

## Goals / Non-Goals

**Goals:**
- Diff old-vs-new across the full trade path and fix root cause(s) for both `match=all` and `match=<appid>` empty selections.
- Loud failures with storage-key diagnostics.

**Non-Goals:**
- Matcher algorithm changes; tradability counting changes; UI redesign; Steam inventory API changes.

## Decisions

- **Old-vs-new diff first, fix second**: line-diff URL builders, persistence shape, trade-page parsing, and selection loop; port the old behavior where new diverges without reason. Alternative (rewrite selection) rejected — risks new divergence.
- **Single partner-key resolver** (raw + `getPartner` fallback, already partially present ~L2191): normalizing lookup in one helper over ad-hoc branches. Alternative (dual writes) rejected — doubles storage churn.
- **Materialize `cardNames` before `buildMatchStore`** (already done ~L608; verify ordering + encode/decode round-trip `encodeURIComponent`/`decodeURIComponent`): keeps ids stable across save/load. Alternative (persist names directly) rejected — larger storage.
- **Keep `Cards` balance gate + alert dialog** (~L2232-2244, ~L2261-2266) as the loud-failure path; add debug prints of resolved filter, partner keys tried, and per-card skip reasons so "no cards, no error" becomes impossible.

## Risks / Trade-offs

- [Risk] Steam trade page DOM/inventory timing differs → selection loop finds no descriptions → Mitigation: log attempted names vs live descriptions; keep retry/poll in `checkContexts`, abort loudly on timeout.
- [Risk] Stale params from a previous scan (wrong partner/filter) → Mitigation: diagnostics print `matches` keys, `filter`, `cardNames` length in debug log and dialog hint.
- [Risk] Held (non-tradable) copies selected at offer time → Mitigation: reuse tradable-only selection (trade-matching requirement); missing-item abort instead of substitution.

## Migration Plan

- Userscript-only change, no migration; users rescan once so params repopulate. Rollback: revert to previous userscript release.

## Open Questions

- None — remaining unknowns (exact divergent line vs old project) are answered by the audit task itself without changing specs or approach.
