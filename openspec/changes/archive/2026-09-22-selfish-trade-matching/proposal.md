# Proposal

## Why

The pasted trade-matching specification was audited against the implementation, and the requester narrowed the gap with three explicit decisions (selfishness scoped to ANY-mode bots, the set-target surplus rule kept, recalculation per execution rather than per trade). The audit verdict: most of the specification is already implemented; exactly one part is missing — the **Selfish** partner side, for ANY-mode partners only. Today the matcher still declines trades that would finish *our* badge faster: it requires every partner to keep a spare copy of whatever they give (retain-one, `tradable > 1` fallback), so an any-cards bot's last copy of a card we need can never be taken. The specification (§4, §5 Condition 3, §8, §11, §19) declares the bot's badge irrelevant — `botCard.owned > 0` suffices — which is exactly how ANY-mode bots accept trades. Fair (non-ANY) bots keep both existing rules, per the requester's scope decision, so offers to them stay acceptable to their own matchers.

### Audit verdict (specification section → status)

| Specification section | Status |
| --- | --- |
| §1-3 core concepts: `owned`/`tradable` distinction, missing = `owned === 0`, held copies still owned | Implemented (`trade-matching`, `tradable-card-filter`) |
| §3 surplus = `max(tradable − 1, 0)` / §5 Condition 1 `ourCard.tradable > 1` | Implemented as `max(tradable − target, 0)` with target 1 for first-set completion — the set-target generalization is kept by explicit requester decision (`− 1` is its first-set case) |
| §5 Condition 2 receive only missing cards | Implemented as "below the applicable set target" — `owned === 0` for first-set completion; the multi-set/even-out continuation stands |
| §9-10 when NOT/SHOULD search bots (complete, no cards, no surplus, last-tradable-copy, duplicate-but-covered) | Implemented: the eligibility gate is exactly *receivable slot ∧ tradable surplus above target* |
| §12/§15 multiple candidates bounded by our surplus; selection alternatives | Implemented: one planning pass bounded per-card by surplus |
| §12/§13 recalculate after every trade | **Deliberately not implemented** — requester decision: recalculation happens per execution (one scan-time snapshot feeds every per-bot plan; per-bot hedging kept), and the in-plan multi-iteration accounting that bounds offers at surplus stays |
| §16 temporarily unavailable copies | Implemented (held copies never offered, never make a card missing) |
| §20 required tests (complete/no-cards/no-surplus/held/alternatives) | Mostly implemented; the **selfish** cases are new (ANY-mode) |
| §4, §5 Condition 3, §8, §11, §19 **selfish bot side** (`botCard.owned > 0`, no bot badge-state evaluation) | **NOT implemented for ANY-mode partners — this change**; fair partners keep both existing rules by explicit requester decision |

## What Changes

- **ANY-mode partner give condition:** a partner that accepts any-cards trades may give a card whenever they own at least one copy (`owned > 0`). The partner retain-one rule is dropped for ANY-mode partners only — their last copy can be taken.
- **Fair partners unchanged:** for bots that do not accept any-cards trades, the retain-one rule (`tradable > 1`, owned-count fallback) and the "must not worsen the bot's badge state" fairness check stay bit-identical.
- **Seam stays:** `MatchDeps.isMatchEverything` and `computeMatches`' `botIndex` parameter are untouched — the flag now selects the partner give condition in addition to the fairness exemption. No signature or call-site changes.
- **Spec delta on `matcher-core`:** MODIFIED *Matches stay fair for both sides unless ANY mode applies* — full content rewrite pinning the mode split: ANY-mode partners give on `owned > 0` with no badge-state evaluation (last copy takeable, post-trade partner state irrelevant); fair partners keep retain-one plus the no-worsening check. Our-side rules are untouched.
- **Explicit deviations from the pasted specification (all requester-confirmed, so implementation must not "fix" them):** (1) §3 surplus stays the set-target rule `max(tradable − target, 0)`; (2) §12/§13 per-trade recalculation stays unimplemented — recalculation is per execution, surplus budgets are enforced within each generated plan and the same surplus may back offers to several bots (per-bot hedging); (3) §4/§8/§19 selfishness is scoped to ANY-mode partners — fair partners keep both rules.
- **Tests:** the specification's §20 selfish cases become ANY-mode fixtures (partner's only copy taken; partner left with duplicates and none of the taken card still valid), red-first; exactly one existing fixture flips ("never takes an ANY-mode partner's last copy" → taken). Fair-partner fixtures stay green throughout as guardrails. The golden reference loop gets the same mode-conditional give guard in lockstep and keeps its any/fair dimension (output still varies by mode).
- **Docs:** AGENTS.md and README.md carry a blanket partner-spare sentence ("partners are only asked for cards they can spare while keeping at least one copy") — reworded to the two-mode model (docs-sync rule).

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `matcher-core`: MODIFIED *Matches stay fair for both sides unless ANY mode applies* (the requirement's identity stands — fair stays fair — but its content is rewritten: ANY-mode partners give on `owned > 0` with no retain-one and no badge-state evaluation, fair partners keep retain-one and the no-worsening fairness check; the existing "last copy" scenario keeps its name and is re-scoped to fair partners, with an ANY-mode takeable case and an ANY post-trade-state-irrelevant scenario added).

## Impact

- Code: `src/lib/matcher-core.ts` only — the partner give guard becomes mode-conditional. The fairness block, `MatchDeps`, `calcBadgeState`, the in-plan accounting, and all signatures are unchanged. No changes to eligibility gating, offer writing, match-row display, scan resume, or settings storage.
- Tests: `test/matcher-core.test.ts` (two new §20 ANY-mode fixtures + one flipped fixture; fair-partner fixtures untouched guardrails), `test/matcher-core-golden.test.ts` (reference loop lockstep with the mode-conditional give guard, keeping its `any` dimension). Untouched suites (tradable gating, scan-lifecycle, offer-writer, match-row, settings) must stay green.
- Behavior visible in the UI: more matches against ANY-mode bots (their last copies of needed cards become tradeable away), hence faster badge completion; fair-bot match output is identical to today. Whether a real bot *accepts* a proposal remains platform behavior, not matcher logic.
- Docs: AGENTS.md overview + README.md trade-matching bullet reworded to the two-mode model; patch version bump (1.0.3 → 1.0.4) per the repo MUST rule.
