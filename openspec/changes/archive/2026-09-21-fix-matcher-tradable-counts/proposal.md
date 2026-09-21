# Proposal

## Why

The matcher conflates "owned" and "currently tradable" into one count per card, so generated trades miss the goal of completing a badge (one of each card) with the fewest trades. Today a card the user already owns but cannot trade yet is treated as unowned, causing the matcher to request a duplicate of it (e.g. trading a spare Card A for another Card D while Card E is still missing), and surplus copies locked by a "Tradable After" date are either silently dropped with the whole badge (inventory mode) or offered and then rejected at the trade-offer page (badge-page mode).

## What Changes

- Split each of the user's badge card counts into two values: **owned** (all copies, per the Steam badge page) and **tradable** (copies currently tradable, per the inventory scan).
- Set-progress math (badge state, `maxSets`/`lastSet`, "need this card" checks, the nothing-to-match badge filter) uses **owned** counts, so a card already owned - even if every copy is temporarily held - is never requested from a partner.
- Offer capacity ("can give this card") uses **tradable** counts: the matcher offers at most the currently tradable surplus, never a held copy. With 5 copies of Card A where 4 are held, exactly one A leaves the account, so exactly one swap is proposed.
- Inventory-mode badge eligibility additionally treats a badge as worth scanning when it has missing cards but at least one tradable copy (today such badges are skipped as "balanced"), so a single tradable duplicate can still fund the missing cards.
- Match rows (the displayed trades) show exactly the cards that will actually be exchanged: offered icons never include held copies, requested icons never include already-owned cards.
- Trade-offer page behavior is unchanged (it already skips held copies); it remains a final safety net.
- Fallback behavior is unchanged: when tradability is unknown (badge-page mode / failed lookup), the tradable count of a card equals its owned count, matching today's badge-page behavior.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `trade-matching`: replace the "eligibility and match counts use tradable copies only" requirement with dual-count semantics (owned counts drive set progress and requests; tradable counts drive offers); extend inventory-mode eligibility to missing-card badges with tradable duplicates; add display accuracy requirements for match rows.
- `tradable-card-filter`: revise "Only tradable cards participate in matching" so trade-held copies stay excluded from offers and send capacity but still count as owned for set-progress and request decisions.
- `matcher-core`: add the pure-matching rules that requests never exceed need (never request an owned card) and offers never exceed tradable capacity, with the badge-state, fairness, and balance rules otherwise unchanged.

## Impact

- `src/lib/models.ts` - `MatchCard` gains an optional tradable-count field (single declaration site; consumers keep compiling).
- `src/lib/matcher-core.ts` - need/give checks become owned/tradable-aware; deterministic behavior changes for badges with held copies.
- `src/ASF-STM.ts` - `GetOwnCards` fills both counts; badge filter and `maxSets`/`lastSet` computed from owned counts; match display unchanged structurally.
- `src/lib/tradable.ts` - `buildScanEligibility` relaxation; `resolveOwnedCount` keeps its fallback role for the offer side.
- `test/matcher-core.test.ts`, `test/matcher-core-golden.test.ts`, `test/tradable.test.ts` - new fixtures for the reported scenarios; golden reference updated deliberately (matching behavior intentionally changes for badges with held copies).
- Docs: `README.md` / `AGENTS.md` matching-behavior notes; version bump per repo rules.
- No changes to settings, storage keys, request layer, or the bundle/single-file build.
