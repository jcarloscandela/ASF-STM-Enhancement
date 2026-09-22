# Design

## Context

See proposal.md for the audit verdict and the requester's scope decisions. Partner-side code in `src/lib/matcher-core.ts` (post `audit-badge-trade-selection`):

- Partner give guard (line ~101): `theirBadge.cards[j]!.count > 0 && (tradableCount ?? count) > 1` — the retain-one rule, applied to every partner, ANY-mode included. This is the one rule this change relaxes (ANY-mode only).
- Fairness block (lines ~126-139): `if (!isMatchEverything(botIndex))` compares `their[partnerReceives].count >= their[partnerGives].count` and `continue`s — already ANY-exempt today and unchanged by this change.
- Seam: `MatchDeps.isMatchEverything` (line 30), injected at `src/ASF-STM.ts:578`; after this change it selects the give condition in addition to the fairness exemption, so it is load-bearing and stays, with `computeMatches`' `botIndex` parameter.
- Tests encoding the partner rules: `matcher-core.test.ts` — "rejects an unfair-to-bot swap that an ANY bot accepts" (line 102, stays), "never takes an ANY-mode partner's last copy" (117, flips), "never takes a fair partner's last copy" (126, stays), "keeps held cards out for fair bots while capping offers at tradable capacity" (244, stays at 2 swaps — the fairness gate still declines the third); the golden reference loop (`matcher-core-golden.test.ts`) reimplements the give guard and fairness block and varies `isMatchEverything` across fixtures (dimension stays — output still varies by mode); `tradable.test.ts` passes the dep at two call sites (unchanged).
- Stale docs: AGENTS.md overview ("partners are only asked for cards they can spare while keeping at least one copy") and the README.md trade-matching bullet (same phrase) describe the rule as partner-agnostic; the new model is mode-dependent.
- Main spec `matcher-core` carries *Matches stay fair for both sides unless ANY mode applies* (the requirement this change MODIFIES); the other four requirements (badge states, per-game balance, determinism, our-side capacity with multi-iteration accounting) are untouched and already match the specification's our-side sections.
- Confirmed non-conflicts: `trade-matching`'s "Fair-bot matching keeps held cards out..." scenario asserts our-side facts that hold for any partner with two copies; `scan-lifecycle`'s partner-skip requirement is our-side only.

## Goals / Non-Goals

**Goals:**
- ANY-mode partners give on `owned > 0`; their badge state (surplus, missing, completeness, post-trade state) never blocks a swap.
- Fair partners keep retain-one and the no-worsening fairness check bit-identical — guardrail fixtures must stay green throughout.
- Pin the pasted specification's §20 selfish cases as ANY-mode tests, red first; flip exactly one existing fixture.
- Keep the requirement's identity via a MODIFIED delta (header unchanged).
- Reword the stale partner-spare wording to the two-mode model (docs-sync).

**Non-Goals:**
- Our-side rules: set-target surplus `max(tradable − target, 0)`, below-target receives, and the in-plan multi-iteration accounting (post-trade owned/tradable bookkeeping within one planning pass) — untouched (requester-confirmed keep).
- Recalculation model: one scan-time snapshot feeding every per-bot plan (per-bot hedging, same surplus may back offers to several bots) — untouched; the pasted specification's §12/§13 per-trade execute-then-recalculate loop remains deliberately unimplemented (requester-confirmed).
- Fair-partner behavior changes of any kind (the specification's §4/§8/§19 would allow them; the requester scoped selfishness to ANY-mode partners).
- Seam or signature changes (`isMatchEverything`/`botIndex` stay; the previous all-bots draft's dead-seam removal is void).
- Bot *selection* settings (`anyBots`/`fairBots` filters, `MatchEverythingFirst/Last` ordering, the ANY badge in the UI) — unchanged.
- Offer-time tradability, match-row display, scan resume/completion, storage formats.
- Whether a real bot accepts the resulting offer — runtime/platform behavior, not matcher logic.

## Decisions

**D1 — Mode-conditional partner give condition; fairness block untouched.** The j-loop guard becomes: ANY-mode partners require only `theirBadge.cards[j]!.count > 0`; fair partners keep `count > 0 && (tradableCount ?? count) > 1`. The `if (!isMatchEverything(...))` fairness block stays exactly as is. Rationale: the requester scoped selfishness to ANY-mode bots — any-cards bots trade regardless of their own badge state (so `owned > 0` models them honestly and unlocks their last copies), while fair bots run their own matching and would decline selfish offers, so both existing rules remain for them. Alternatives considered: apply selfishness to all partners (the earlier all-bots draft; rejected by explicit requester decision); fetch partner tradability to keep a tradable-based retain — rejected, partner badges never carry `tradableCount` (badge-page parser output) and the owned fallback already models that.

**D2 — `isMatchEverything`/`botIndex` stay load-bearing.** The flag now selects the give condition in addition to the fairness exemption, so the seam remains the single place mode-dependent behavior is resolved and no signature or call-site changes are needed. Alternatives considered: remove the seam as dead code — rejected (it is the mode discriminator this change is built on; that removal belonged to the superseded all-bots draft).

**D3 — Delta shape: MODIFIED with the exact existing header and retained scenario names.** The requirement name still describes the model (matches stay fair for both sides *unless ANY mode applies* — and ANY mode now applies the selfish rule fully), so the requirement keeps its identity and the delta carries the full updated content: the mode split in the requirement text plus five scenarios (unfair-to-bot rejected for fair bots, ANY uneven accepted, last copy never taken from fair partners, ANY last copy taken, ANY post-trade state irrelevant). The validator requires a MODIFIED block to retain every existing scenario name (it replaces the whole block at archive), so the old "A partner's last copy is never taken" name is kept and its content re-scoped to fair partners, with the ANY-mode takeable case added as a new scenario alongside it. Alternatives considered: REMOVED + ADDED to rename that scenario cleanly (rejected — the header is not false under this scope, and MODIFIED preserves requirement identity through archive; the retained name is disambiguated by its WHEN clause and the adjacent ANY-mode scenario).

**D4 — Fixture plan with fair-mode guardrails.** Red first: two new §20 ANY-mode fixtures in `test/matcher-core.test.ts` — (a) ours `[1,2,0,1,1]` vs an ANY partner owning only the needed card (`C: 1`) → exactly `B -> C` proposed (the partner's last copy is taken), and (b) ours `[1,2,0,1,1]` vs an ANY partner `B: 2, C: 1` → `B -> C` still proposed although the partner ends with three B and zero C. Exactly one existing fixture flips: "never takes an ANY-mode partner's last copy" → the swap IS proposed. The fair-partner fixtures stay untouched and green throughout as guardrails ("never takes a fair partner's last copy", "rejects an unfair-to-bot swap that an ANY bot accepts", "keeps held cards out for fair bots..." at 2 swaps). The golden reference loop gets the same mode-conditional give guard in lockstep and KEEPS the `for (const any of [false, true])` dimension. Alternatives considered: flip the fair fixtures too (rejected — contradicts the ANY-only scope); drop the golden `any` dimension (rejected — mode still varies output).

**D5 — Docs wording updated in the same change (docs-sync).** AGENTS.md overview and the README trade-matching bullet keep their blanket partner-spare promise; both are reworded to the two-mode model ("ANY-mode partners are treated as pure card sources — `owned > 0` suffices, even the last copy — while fair partners keep at least one copy and only take badge-neutral swaps"). Archived changes keep their historical wording (never rewrite archives).

**D6 — The requester-confirmed deviations from the pasted specification are pinned, not "fixed".** (1) §3 surplus stays `max(tradable − target, 0)` (set-target generalization; `− 1` is its first-set case). (2) §12/§13 per-trade recalculation stays unimplemented — recalculation is per execution and surplus budgets are enforced within each generated plan (per-bot hedging across plans). (3) §4/§8/§19 selfishness applies to ANY-mode partners only. All three were explicitly decided by the requester; the specification's literal text is narrower than the approved scope. Alternatives considered: implement the specification literally — rejected across the board by those decisions.

## Risks / Trade-offs

- [ANY bots' own ASF trading logic may still decline offers that strip their badge] → Accepted: the matcher proposes; acceptance is platform behavior (proposal.md Impact). Users keep `anyBots`/`fairBots` selection settings to choose whom to scan.
- [Fair bots keep both rules → fewer matches than the specification's pure-selfish model] → Deliberate scope (requester decision): keeps offers acceptable to fair bots' own matchers; documented in D1/D6.
- [Implementer applies selfishness to fair bots too, following the pasted specification] → D6 and the proposal's deviations section call the scope out explicitly; the fair-partner guardrail fixtures (D4) fail the moment those rules are touched.
- [Flipped fixtures silently weaken coverage if only assertions change] → Only one fixture flips, red-first with the exact expectation delta (never-taken → taken); two §20 fixtures add net-new ANY-mode coverage.
- [Golden reference drifts from the real matcher] → Same-commit lockstep edit to both loops; the exhaustive any/fair sweeps compare them on every run.
- [Spec/archive drift at sync time] → MODIFIED carries the full updated content with the exact existing header; `openspec validate --strict` gates the change before archive.

## Migration Plan

Patch release: bump `package.json` (1.0.3 → 1.0.4), rebuild `dist/ASF-STM.user.js`. No storage keys, settings, request formats, or dependencies change. Rollback = previous release asset.

## Open Questions

None — all three scope points (ANY-only selfishness, set-target surplus, per-execution recalculation with per-bot hedging) were explicitly decided by the requester.
