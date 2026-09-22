# Design

## Context

Motivation is in proposal.md (Why). This document records what the audit found in the current code and how to close the gaps.

Audit findings (current implementation vs the required model):

| Rule | Current implementation | Verdict |
| --- | --- | --- |
| Offer surplus = tradable copies above the retained target | `computeMatches` gives while `count > target && tradableRemaining > 0` (`src/lib/matcher-core.ts`) — can spend a card's last tradable copy (owned 5 / tradable 1 → 1 swap) | **Deviation — fix** |
| Bot-search gate = has receivable slot AND tradable surplus | `buildScanEligibility` (`src/lib/tradable.ts`): unbalanced distribution AND ≥1 tradable copy anywhere | **Deviation — fix** |
| Partner keeps at least one copy of what they give | Partner gives while `count > 0`; the relative-fairness check is skipped for ANY-mode bots | **Deviation — fix (add rule)** |
| Receive only cards below the applicable set target; never a card owned (first set) | Receive while `count < target` | Conforms |
| Held copies count as owned, never as offerable; unknown tradable → owned fallback | `tradableCount ?? count`, clamped by `count` | Conforms |
| Stop when badge complete or no valid trade | `while (state < 2)` with break on no match | Conforms |
| Deterministic, per-game balance, match rows show only exchanged cards | Present, covered by existing requirements | Conforms |
| One calculation per execution; recalc when execution restarts | Matches are computed once per scan; a rescan recomputes | Conforms (now explicitly clarified) |

Relevant mechanics: set targets are `maxSets = floor(totalOwned / setSize)` and `lastSet = ceil(totalOwned / setSize)` (`src/lib/badge-page.ts`); badge state 0 trades against `maxSets`, state 1 against `lastSet`. Partner (bot) badges carry owned counts only — partner tradability is never fetched, so the matcher's `tradableCount ?? count` fallback applies to the partner side. The test suite mirrors the matcher in `test/matcher-core-golden.test.ts` (a second copy of the loop) plus `test/matcher-core.test.ts` and `test/tradable.test.ts`.

## Goals / Non-Goals

**Goals:**
- Make the offer rule the strict surplus `max(tradable − target, 0)` everywhere the matcher decides what to give.
- Make the bot-search gate the same predicates the matcher uses (receivable slot + offerable surplus), computed from the badge's own counts/targets.
- Require every partner to retain at least one copy of any card they give, without removing the existing fair-bot fairness check or its ANY-mode exemption.
- Keep the clarified execution model: the trade plan is computed once per scan; recalculation happens when a new execution starts.
- Align fixtures, golden tests, and docs with the above.

**Non-Goals:**
- No fetching of partner inventory/tradability data (owned-count fallback stays).
- No change to the badge state model, set targets (`maxSets`/`lastSet`), or multi-set/even-out behavior.
- No change to held-copy detection, badge-detail/data plumbing, match-row rendering, or trade-offer page item selection (already covered by existing specs).
- No persisted-storage format change and no new dependencies.
- No live recalculation loop after individually executed trades.

## Decisions

1. **Offer rule = `tradable > applicable target` (single condition).** In state 0 the target is `maxSets`, in state 1 it is `lastSet`; for first-set completion the target is 1, which is exactly the requested literal rule `tradable > 1` / `surplus = max(tradable − 1, 0)`. This subsumes the old owned-surplus check (`tradable ≤ owned`, so `tradable > target` implies `count > target`) and collapses two conditions into one. Alternatives considered: applying literal `tradable > 1` regardless of target — rejected, it would offer copies below a multi-set target and lose badge progress (user chose to generalize to set targets); basing surplus on owned counts — rejected, it ignores held copies and reopens the last-tradable-copy hole. With unknown tradability (`tradable = owned`) the rule reduces to `owned − target`, i.e. the give capacity badges of that distribution always had, so badge-page mode does not regress.

2. **Partner retain-one as an added, universal candidate condition.** On the give side of each candidate pair, require the partner's tradable count for the card they send — falling back to their owned count — to be `> 1`. This runs for all partners (ANY-mode included); the existing "must not worsen the bot's badge state" check stays as an additional constraint and keeps its ANY-mode exemption. Alternatives considered: replacing the fairness model with the surplus rule alone — user chose to keep fairness; fetching partner inventories for real tradability — rejected as scope creep; skipping partners when tradability is unknown — rejected, it would disable matching entirely since partner tradability is never fetched.

3. **Eligibility gate derives the same predicates, not a distribution heuristic.** Rewrite `buildScanEligibility` to zero-fill the badge's slots to the set size, compute `maxSets`/`lastSet` with the same floor/ceil formula the badge page uses, pick the applicable target with the same state rule the matcher uses, and flag a badge eligible iff some slot is below the target AND some slot has `tradable > target`. The gate thus answers exactly the matcher's question ("could any swap exist for any partner") and shares the specs' receivable/offerable wording. Alternatives considered: leaving the unbalanced+has-tradable heuristic and letting the matcher return empty — rejected, the spec requires that such badges are never checked against partners (wasted partner checks today).

4. **One planning pass per execution, no mid-execution recalculation.** `computeMatches` already plans a badge's swaps in a single pass with simulated decrements (post-trade state is reasoned about *within planning*); after real offers are executed, state is recomputed only when execution starts again (a new scan). This adopts the request's closing clarification over its earlier "recalculate after every trade" section; no new re-run loop is built. Recorded assumption: in the request's Example 1 the phrase "alternative trades" is read as *candidates are alternatives at selection time* — a single plan may still contain several sequential swaps bounded by per-card surplus, preserving the existing "full capacity fills every missing card" behavior.

5. **Keep everything in the existing pure modules.** The give/partner conditions live in `src/lib/matcher-core.ts` and the gate in `src/lib/tradable.ts` — both already fixture-testable with no DOM/network; `src/ASF-STM.ts` keeps only thin wiring. The golden-test reference loop must be updated in lockstep or the determinism/golden suite will diverge from the real matcher.

## Risks / Trade-offs

- [Hold-heavy badges produce fewer matches than before (owned 5 / tradable 1 now yields zero swaps)] → Intended by the strict-surplus decision; scenarios pin the new expectations and the release/README notes should mention it.
- [Gate and matcher could disagree on the applicable target (eligible badge that can never trade, or the inverse)] → Both sides derive `maxSets`/`lastSet` with the same floor/ceil + state rule; add a parity fixture exercising the gate and the matcher on the same badge.
- [Partner retain-one blocks trades ANY-mode bots would have accepted (their last copy)] → Required by the core invariant; the ANY exemption is preserved for the fairness check only, so this is the single intended narrowing.
- [Golden reference implementation drifts from the real matcher] → Update `test/matcher-core-golden.test.ts` in the same change; existing determinism tests compare two runs of the same loop.
- [Spec/archive drift: modified requirements must fully replace their main-spec counterparts] → Deltas copy the full requirement blocks under `MODIFIED`; `openspec validate --strict` gates the change before archive.

## Migration Plan

Behavior-only userscript release: bump the `package.json` version (patch), rebuild `dist/ASF-STM.user.js`. No storage keys, URL params, or persisted match formats change, so existing stored scans keep working; users simply see stricter gating/matching on the next scan. Rollback = republish the previous release asset (no data migration to undo).

## Open Questions

None — the three material questions (offer-capacity rule, completion model, partner-side rule) were resolved with the user before this design, and the recalculation clarification is recorded under Decisions.
