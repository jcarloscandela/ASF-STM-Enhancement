# Design

## Context

See proposal.md for motivation. Today `GetOwnCards` (src/ASF-STM.ts) overwrites each of the user's badge card counts with the **tradable** count from `resolveOwnedCount` whenever an inventory scan ran, and falls back to the badge-page `owned` count otherwise. Everything downstream - the nothing-to-match filter, `maxSets`/`lastSet`, and `computeMatches` (src/lib/matcher-core.ts) - then reasons over that single number. The result: a card the user owns but cannot trade yet is treated as unowned (so the matcher requests a duplicate of it), and held surplus copies either get the whole badge dropped (inventory mode) or are offered and rejected at the trade-offer page (badge-page mode). The existing specs `trade-matching` and `tradable-card-filter` mandate this conflated behavior and are revised by this change.

## Goals / Non-Goals

**Goals:**

- One card, two numbers: owned copies (badge page) vs currently tradable copies (inventory scan).
- Requests (receive side) driven by owned counts; offers (send side) capped by tradable counts.
- Unit-testable pure-matcher rules matching the two reported scenarios exactly.
- Preserve determinism, bot fairness, per-game 1:1 balance, and the badge-page fallback.

**Non-Goals:**

- No changes to the trade-offer page item selection (it already skips held copies; it stays as the final safety net).
- No changes to settings, storage shapes/keys, request/retry layer, or build tooling.
- No knowledge of the partner's tradability (badge pages do not expose it; their owned counts are used as today).
- No UI additions beyond what the corrected matcher already renders (no new held-copy badges/labels in this change).

## Decisions

### D1: `count` stays owned; add optional `tradableCount` to `MatchCard`

`MatchCard.count` reverts to meaning *owned* copies (badge-page `owned`), and a new optional `tradableCount` (declared once in src/lib/models.ts) carries the currently tradable copies when known. `GetOwnCards` sets `count = owned` always and `tradableCount` from the tradable-counts lookup (`undefined` when unknown).

- *Why not `count` = tradable + new `ownedCount`?* `count` is read as "copies owned" by the state math, the bot-badge scaffolding, and every existing test fixture; keeping its meaning minimizes churn and makes the unknown-tradability fallback (`tradableCount === count`) the natural default.

### D2: Matcher tracks per-slot tradable remainder internally

`computeMatches` deep-clones badges already. On the user's side it initializes `tradableRemaining = tradableCount ?? count` per slot and adds a capacity gate to the give check: offer only while the owned-surplus condition (`count > maxSets` / `count > lastSet`) **and** `tradableRemaining > 0` hold. A send decrements `count` and `tradableRemaining`; a receive increments both (a received copy is tradable, keeping the invariant `tradableRemaining <= count`). Need checks, `calcBadgeState`, the send/receive bookkeeping, fairness check, and sort (by owned `count` desc) are unchanged.

- *Alternative considered:* run the loop twice (need pass on owned, capacity pass on tradable) - rejected: the single-loop interleaving of sends/receives is what keeps swaps fair and balanced per iteration.

### D3: Badge filter and set targets need no code change

The nothing-to-match filter (`max - min < 2`) and the `maxSets`/`lastSet` computation already operate on whatever counts the cards carry; with owned counts restored they reason about owned sets, which is exactly the intended semantics. The filter stays correct: with `max - min < 2` no slot is below `maxSets` while another is above it, so no owned-need × owned-surplus pair exists. Only the inputs change.

### D4: `GetOwnCards` no longer needs `resolveOwnedCount` for `count`

`resolveOwnedCount`'s override role moves to filling `tradableCount`. Its fallback semantics (unknown lookup → no `tradableCount`) preserve the badge-page behavior mandated by the "Missing tradability data falls back safely" requirement. The function stays in src/lib/tradable.ts with adjusted usage.

### D5: Eligibility relaxation is a one-condition change

`buildScanEligibility` currently marks a badge unbalanced when the tradable distribution is uneven or `size < max_size && min > 0`. The `min > 0` guard is what drops the single-tradable-duplicate badge (scenario 2); it becomes `count > 0` (some tradable copy exists). Badges with zero tradable copies stay excluded; false positives are re-filtered after `GetOwnCards` by the owned-based nothing-to-match filter at the cost of one badge-detail fetch per badge (already rate-limited by `weblimiter`).

### D6: Golden tests are updated deliberately

test/matcher-core-golden.test.ts pins the pre-extraction userscript behavior verbatim. Since matching behavior intentionally changes for badges with held copies, the reference implementation inside that test is updated to the same owned/tradable rules, and its exhaustive small fixtures gain held-copy cases. The equivalence property being tested (matcher-core ≡ reference, deterministic) is preserved. test/matcher-core.test.ts adds the two reported scenarios plus fallback and multi-set cases; test/tradable.test.ts covers the eligibility relaxation.

### D7: Multi-set badges follow the same split (assumption)

The reported examples are single-set. For state-1 "even out" badges the same rule applies: need checks compare owned counts against `lastSet`, capacity still gates sends. Recorded here as the consistent generalization of the reported behavior; no separate spec scenario pins it beyond the fallback case.

## Risks / Trade-offs

- [Relaxed eligibility adds badge-detail fetches in inventory mode] → Bounded by the badges-db mapping (only badges the user holds tradable cards of) and the existing `weblimiter` pacing; badges with nothing to match are dropped before any bot is scanned.
- [Fewer swaps offered than before for held-duplicate badges] → Intended behavior; the previous extra swaps requested owned cards. Debug build logs owned vs tradable counts per card to make the difference auditable.
- [Received copies assumed immediately tradable] → Steam trading cards received in a trade are tradable; if Steam ever holds them, the remainder is slightly optimistic for the rest of that matching session only. The offer page still verifies against the live inventory.
- [`tradableCount` is a scan-time snapshot] → A hold may expire between scan and offer; the offer-page held-copy skip (unchanged) is the safety net, matching today's behavior.
- [Behavior change visible to existing users] → Version bump per repo rules; README matching-behavior note updated in the same change.

## Migration Plan

No storage or settings migration: `tradableCount` is an in-memory field on freshly built badges, and `tradeParams` output shape is unchanged. Rollback is a normal revert of the source change plus version bump.

## Open Questions

None. The two reported scenarios pin the externally observable behavior; the fallback and multi-set cases are decided in D5/D7.
