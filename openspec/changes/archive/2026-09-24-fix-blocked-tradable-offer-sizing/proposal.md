# Proposal

## Why

A user holding 13 copies of "Zombie from Two Worlds: Epic Edition" (12 temporarily trade-held with a future "Tradable After" date) reports the matcher sizes offers from owned counts instead of currently-tradable copies. The same under/over-count appears in the minimal repro: 4×A with 3 held yields one real swap (A→B/C/D/E), and 4×A with 2 held yields two real swaps — the offerable count is the tradable copies above the retained owned target, not the owned surplus. Without this fix, generated offers either include held copies Steam will omit or suppress valid swaps that only need the tradable remainder.

## What Changes

- Offer-cap rule changes from retained-tradable (`surplus = max(tradable − target, 0)`) to retained-owned with a tradable ceiling: `offerable = max(min(tradable, owned − target), 0)` per card slot; a slot is offerable only while it both has a currently-tradable copy and owns more than the applicable set target.
- Eligibility / pre-check gates (`buildScanEligibility`, badge swap-possibility check) use the same rule: receivable (owned below target) AND offerable (`tradable ≥ 1` and `owned > target`) instead of `tradable > target`.
- Receiving a card still increments both owned and tradable remainder; sending decrements both — unchanged bookkeeping, now applied to the relaxed cap.
- Held copies still count as owned for set-progress, badge state, `maxSets`/`lastSet` targets, nothing-to-match filtering, and request decisions (an owned-even-held card is never requested); held copies are still never selected on the offered side or on the trade-offer page.
- Unknown tradability fallback is unchanged (`tradable = owned`, which collapses the new formula back to the old surplus).

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `trade-matching`: offer-cap, eligibility, and swap-possibility requirements change from `tradable − target` surplus to `min(tradable, owned − target)` surplus.
- `matcher-core`: pure-matcher give-check changes from `tradableRemaining > target` to `tradableRemaining ≥ 1 AND count > target` (capped at both remainders).

## Impact

- Affected code: `src/lib/matcher-core.ts` (give-check, bookkeeping comments), `src/lib/tradable.ts` (`buildScanEligibility` offerable gate, badge swap-possibility helper if present), trade-offer item selection (no logic change — already skips held copies — verified only).
- Tests: `test/matcher-core.test.ts`-style fixtures plus eligibility tests covering the two reported repros (4×A/3-held→1 swap; 4×A/2-held→2 swaps) and the changed fully-held edge (5×A/4-held→1 swap, was 0).
- Docs: `AGENTS.md`/`README.md` surplus wording (`max(tradable − target, 0)` → retained-owned formula) if they state the old rule.
