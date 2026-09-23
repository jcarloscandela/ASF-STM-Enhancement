# Design

## Context

See proposal.md (Why) for motivation. Current state (observed in `src/lib/`):

- `matcher-core.ts` seeds `tradableRemaining = min(tradableCount ?? count, count)` and gates offers on `tradableRemaining > maxSets/lastSet` — a retained-*tradable* rule. With 4×A/3-held (tradable = 1, target = 1) it offers nothing; the report expects one swap.
- `tradable.ts` `buildScanEligibility` gates candidates on `tradable > target` — same retained-tradable rule at the eligibility layer.
- The badge swap-possibility precheck (trade-matching "never checked" requirement) applies the same gate before any partner is contacted.
- The trade-offer page already skips held copies during item selection, so offering a tradable copy above the retained *owned* count needs no offer-page change.

## Goals / Non-Goals

**Goals:**

- One shared offerability rule across all three gates: offerable iff `owned > target AND tradable ≥ 1`, capped at `min(tradable, owned − target)`.
- Reported repros produce exactly 1 swap (4×A/3-held) and 2 swaps (4×A/2-held); fully-tradable behavior is bit-for-bit unchanged.

**Non-Goals:**

- No change to partner-side rules (ANY take-anything vs fair retain-one), badge-state derivation (owned counts), request decisions (owned need), per-game balance, deterministic ordering, or serial badge-detail fetching.
- No change to trade-offer item selection (already tradable-only); verified, not modified.
- No new network calls, storage keys, or settings.

## Decisions

- **Retained-owned (not retained-tradable) with a tradable ceiling.** Rationale: held copies already count as owned for set progress, so keeping one owned copy (held or not) preserves badge completion; the only hard constraint is that the *sent* copy be tradable. Formula `max(min(tradable, owned − target), 0)` reduces to the old `max(tradable − target, 0)` whenever `tradable == owned` (fully tradable or unknown-fallback), so existing fixtures for those distributions keep passing unchanged. Alternative (status quo retained-tradable) was rejected: it strands tradable copies behind held duplicates, exactly the reported bug. Alternative (pure owned surplus, ignoring tradable) was rejected: it would reintroduce offers Steam cannot fill.
- **Apply the same predicate at all three gates** (matcher give-check, `buildScanEligibility`, swap-possibility precheck). Rationale: the gates must agree or badges will oscillate between eligible-but-unmatchable and matchable-but-filtered. Alternative (matcher only) was rejected for that reason.
- **Keep dual-decrement bookkeeping unchanged** (send decrements both owned and tradable remainder; receive increments both). Rationale: each offered copy consumes one tradable and one owned unit, so iteration accounting stays exact under the relaxed cap with no new state.
- **Docs + version bump ride along** per repo MUST rules (docs-sync, `package.json` patch bump); no `dist/` commit.

## Risks / Trade-offs

- [Risk] Offering the last tradable copy leaves only held copies of that card until holds expire → Mitigation: accepted by design; badge progress is preserved (owned coverage remains) and the trade-offer page never substitutes a held copy, so the worst case is a temporarily untradable remainder, not a broken badge.
- [Risk] Three spec scenarios change outcome (5×A/4-held 0→1 swap; 4×A/2-held 1→2 swaps; owned-duplicate-plus-tradable precheck now trades when gaps exist) → Mitigation: deltas rewrite those scenarios explicitly; old expectations must be updated, not kept alongside.
- [Risk] Eligibility gate and matcher gate drifting apart → Mitigation: single shared predicate; tasks add paired fixture tests (eligibility + matcher) for both repros.

## Migration Plan

- Ship in the normal single-file userscript build; no data migration (no stored format changes). Rollback is the previous release asset.

## Open Questions

- None. The scope question (retain-owned vs retain-tradable) is settled by the reported repros; anything subtler (e.g. per-copy hold-expiry ordering) stays as-is.
