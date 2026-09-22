# Proposal

## Why

An audit of the badge trade-candidate process (gating, candidate generation, partner checks, and the trades the match rows display) found three places where the implementation deviates from the owned/tradable/surplus model the tool should run on: the matcher can spend a card's last tradable copy, the bot-search eligibility gate is a distribution heuristic (unbalanced + any tradable copy) instead of "has missing cards AND has tradable surplus", and partners can be asked for their last copy of a card. These deviations produce trades that are either impossible to execute safely or that risk badge progress, and partner checks on badges that could never trade anyway.

## What Changes

- **Strict tradable surplus**: a card is offerable only while its currently tradable copies exceed the applicable set target — `surplus = max(tradable − target, 0)` (for first-set completion the target is 1, i.e. the literal `max(tradable − 1, 0)` / `tradable > 1` rule). Owned 5 / tradable 1 with a one-set target now yields zero swaps instead of one.
- **Eligibility gate becomes missing + surplus**: a badge is checked against bots only when it has at least one receivable slot (count below the applicable set target) AND at least one slot with tradable surplus above that target, replacing the current "unbalanced distribution AND at least one tradable copy" heuristic.
- **Partner retains one copy, for every partner**: a partner may give a card only while they keep at least one copy (partner tradable count, falling back to owned count since partner tradability is not fetched). This applies to ANY-mode bots too; the existing fair-bot "must not end up worse off" check and its ANY-mode exemption remain as an additional constraint.
- **Single calculation per execution (clarified)**: the trade plan is computed once when a scan/execution starts; state is recalculated when execution starts again (a new scan), not after every executed trade. This matches the current scan model and is recorded so no mid-execution recalculation loop is introduced.
- Affected fixtures/golden tests and contributor/user docs are updated to the strict rules; no persisted-data format changes.

## Capabilities

### New Capabilities

(none — the audit's findings map onto existing capabilities)

### Modified Capabilities

- `matcher-core`: offer condition tightens from "owned above target with ≥1 tradable copy" to "tradable copies above the applicable set target"; a new partner-side retain-one rule applies to all partners (ANY-mode remains exempt only from the relative-fairness check); scenarios covering owned 5 / tradable 1 are updated from one swap to zero swaps.
- `trade-matching`: offer capacity capped at `max(tradable − target, 0)` rather than the raw tradable count; bot-search/eligibility requirements (inventory-mode eligibility and the "no tradable path" gate) redefined as receivable slot + tradable surplus above target, replacing the unbalanced-and-has-tradable heuristic and its scenarios.

## Impact

- Code: `src/lib/matcher-core.ts` (give/partner rules in `computeMatches`), `src/lib/tradable.ts` (`buildScanEligibility` gate); thin wiring in `src/ASF-STM.ts` only if the gate's call site needs the set targets.
- Tests: `test/matcher-core.test.ts`, `test/matcher-core-golden.test.ts`, `test/tradable.test.ts` — capacity, eligibility, and partner retain-one fixtures (some existing expectations flip: one swap → zero swaps).
- Behavior visible in the UI: fewer bot searches on hold-heavy badges, match rows that never propose spending the last tradable copy or a partner's last copy.
- No changes to persisted storage formats, the trade-offer page selection flow, the badge/set-target model, or dependencies. Version bump in `package.json` required (patch).
