# trade-matching

## Purpose

Defines how the scanner decides which of the user's owned Steam cards are eligible to be counted toward badge completion and offered in a trade, so that generated offers only contain cards the account can actually trade.

## Requirements

### Requirement: Non-tradable cards are excluded from matching

The scanner SHALL determine the tradability of each owned card from the Steam inventory response and SHALL treat copies that are not currently tradable (trade-held) as unavailable to be offered in a trade. "Not currently tradable" includes copies flagged by the current trade-state signal AND copies whose "Tradable After" timestamp is in the future at scan time. Held copies remain owned cards for set-progress and request decisions, but SHALL never be selected as cards to send, in every scan mode: the inventory scan, the legacy badge-page scan, and scan filters.

#### Scenario: Trade-held cards are excluded during inventory scan

- **WHEN** the inventory scan fetches an inventory containing both tradable and trade-held copies of a card
- **THEN** only the tradable copies are available to offer, and no held copy appears on the offered side of any match row

#### Scenario: Trade-held cards are excluded during badge-page scan

- **WHEN** the user runs a scan with the inventory scan disabled or with scan filters
- **THEN** the scanner still obtains tradability information where available and omits trade-held cards from the offered side of match rows

#### Scenario: A match that would require offering a held card is not produced

- **WHEN** the only surplus copies the user could offer for a badge are trade-held
- **THEN** no match is generated for that badge and no offer is created with an empty user side

#### Scenario: Future-dated holds are excluded in every scan mode

- **WHEN** an owned card (e.g. Alyx Vance, Half-Life 2) carries a "Tradable After" date in the future at scan time
- **THEN** that copy cannot be offered in inventory, badge-page, or scan-filter modes until the date has passed, while it still counts as an owned copy for set-progress and request decisions

### Requirement: Badge counts separate owned copies from tradable capacity

The scanner SHALL maintain, per card of the user's badges, both the owned copy count (all copies, as reported by the Steam badge page) and the currently tradable copy count (from the inventory scan when available). Set-progress decisions - badge state, set targets (`maxSets`/`lastSet`), whether a card is still needed, and the nothing-to-match badge filter - SHALL use owned counts, so a card the user already owns is never requested from a partner even when every owned copy is temporarily held. Offer decisions SHALL use tradable counts: the number of copies offered of a card SHALL NOT exceed its currently tradable count. When tradability is unknown, the tradable count of a card SHALL equal its owned count (badge-page fallback).

#### Scenario: Owned-but-held card is not requested

- **WHEN** the user owns one copy of Card D that is temporarily trade-held, misses Cards B, C, and E, and a partner holds two copies of each card
- **THEN** no swap requests Card D; the proposed swaps only request cards with zero owned copies (B, C, and E)

#### Scenario: Offer count is capped at tradable copies

- **WHEN** the user owns five copies of Card A of which four are temporarily held, and misses Cards B, C, and E
- **THEN** exactly one copy of Card A is offered across the badge's matches, producing exactly one swap

#### Scenario: Fully tradable surplus fills every missing card

- **WHEN** the user owns five tradable copies of Card A, one held copy of Card D, and misses Cards B, C, and E, and a partner holds two copies of each
- **THEN** the matcher proposes exactly three swaps (A to B, A to C, A to E) and none of them requests Card D

#### Scenario: Unknown tradability falls back to owned counts

- **WHEN** tradability data is unavailable for a badge (failed lookup or badge-page mode)
- **THEN** the offer capacity of each card equals its owned count and matching behaves as the badge-page scan always has

### Requirement: Match rows display only the exchanged cards

Match rows SHALL display, per side, exactly the cards the generated offer will exchange: the offered side shows the currently tradable copies that will be sent (never a held copy), and the requested side shows only cards the user does not already own within the applicable set targets.

#### Scenario: Offered icons exclude held copies

- **WHEN** a match offers one of five owned copies of Card A because four copies are held
- **THEN** the match row shows a single Card A icon on the offered side

#### Scenario: Requested icons exclude already-owned cards

- **WHEN** a partner owns two copies of Card D and the user already owns Card D
- **THEN** the requested side of the match row contains no Card D icon even though the partner could send it

### Requirement: Inventory-mode eligibility includes badges that can complete sets

In inventory mode, badge eligibility SHALL mark a badge as a matching candidate when its owned-copy distribution across the game's cards is unbalanced (some cards hold more copies than others relative to the set size; missing cards count as zero owned copies) AND at least one card of the badge has at least one currently tradable copy. A badge with no tradable copies at all SHALL remain excluded - its surplus cannot be offered.

#### Scenario: Missing-card badge with a tradable duplicate is scanned

- **WHEN** a badge has one tradable copy of Card A, no tradable copies of the remaining cards, and the user owns held copies of some of them
- **THEN** the badge is included in the candidate badge list and proceeds to bot matching

#### Scenario: Badge with no tradable copies stays excluded

- **WHEN** every card copy of a badge is currently trade-held
- **THEN** the badge is not included in the candidate badge list

#### Scenario: Owned-count unbalance drives eligibility

- **WHEN** a badge's owned copies are distributed unevenly across its cards (e.g. five copies of one card, one of another, none of the rest)
- **THEN** the badge is a candidate as long as at least one copy is currently tradable, regardless of how many copies are held

### Requirement: Badge detail fetches run with bounded concurrency

The badge-detail stage SHALL fetch candidate badges with bounded concurrency: at most a fixed number of `ajaxgetbadgeinfo` requests SHALL be in flight at once, and each subsequent launch SHALL be separated by the web limiter delay, keeping the same per-request rate-limit friendliness as the serial scan. Each badge SHALL settle exactly once - on a successful detail fetch or on an invalid-badge response - and badges that fail with retryable errors SHALL retry within the global error budget before the scan aborts with the existing visible error. Invalid badges SHALL be filtered only after every badge has settled, and the resulting candidate list and match output SHALL be identical to a serial scan of the same data.

#### Scenario: Candidate count exceeds the concurrency cap

- **WHEN** more candidate badges than the concurrency limit are pending
- **THEN** at most that many detail requests are in flight at once, and each next request launches only after a web-limiter delay

#### Scenario: Results match a serial scan

- **WHEN** the same candidate badges are scanned by the concurrent detail stage and by a serial scan
- **THEN** both produce the same candidate list (invalid badges filtered) and the same match output

#### Scenario: Retryable failure retries within the error budget

- **WHEN** a badge detail request fails with a retryable error while the global error budget is not exhausted
- **THEN** that badge retries after the shared retry delay, and a scan-aborting failure surfaces the existing visible error instead of being retried indefinitely

### Requirement: Missing tradability data falls back safely

If tradability information cannot be retrieved, the scanner SHALL fall back to counting the affected cards instead of dropping them, so that a failed lookup does not silently suppress valid matches.

#### Scenario: Inventory request fails

- **WHEN** the tradability lookup fails while scanning
- **THEN** the scan continues using the previous count behavior and reports the failure in the debug build

#### Scenario: Card has no tradability field

- **WHEN** a card's inventory entry does not report tradability
- **THEN** the card is treated as tradable rather than excluded

### Requirement: Trade-offer creation only adds currently-tradable copies

The system SHALL, when building a trade offer on the Steam trade-offer page, select only copies that are currently tradable at offer time. Held copies (trade-state negative or future "Tradable After") SHALL be skipped during item selection; if a requested card has no currently-tradable copy in the live trade inventory, the offer flow SHALL surface the existing missing-items abort instead of substituting a held copy.

#### Scenario: Held copy is skipped when adding cards to the offer

- **WHEN** the user opens a generated match on the trade-offer page and the live inventory contains both a held copy and a tradable copy of a requested card
- **THEN** only the tradable copy is moved into the trade, and the held copy is left in the inventory

#### Scenario: All copies held aborts instead of offering untradable cards

- **WHEN** every live-inventory copy of a requested card is currently untradable (including future-dated holds)
- **THEN** the missing-items abort is shown and no held card is added to the offer

### Requirement: Inventory-mode scan derives badges from inventory only

When the resolved scan plan is inventory mode, the scanner SHALL derive the badge candidate list exclusively from the fetched Steam inventory (tradable counts mapped onto the badges database) and SHALL NOT issue requests to the badge pages (`/badges?p=N`) nor to per-badge detail pages during candidate discovery.

#### Scenario: Inventory mode performs no badge-page requests

- **WHEN** a scan runs with inventory mode resolved and the inventory fetch plus badges database load succeed
- **THEN** zero HTTP requests are issued to badge pages while building the candidate badge list

#### Scenario: Inventory mode result matches inventory eligibility

- **WHEN** a scan runs in inventory mode over an inventory with unbalanced (duplicated/incomplete) badges
- **THEN** the candidate badge list contains exactly the unbalanced appIds from the inventory-to-badges-database mapping, and the scan proceeds to per-card detail from there

### Requirement: Inventory-mode failure does not silently fall back to badge pages

When inventory mode cannot build eligibility (inventory fetch fails, badges database unavailable, or tradability unknown and unrecoverable), the scanner SHALL NOT silently run the badge-page scan. It SHALL abort the scan with an explicit error surfaced in the UI (and debug log in the debug build), preserving the resolved inventory mode.

#### Scenario: Inventory fetch failure aborts with error

- **WHEN** a scan runs in inventory mode and the inventory fetch fails
- **THEN** no badge-page requests are issued and the scan aborts with a visible error indicating the inventory scan failed

#### Scenario: Missing tradability data aborts instead of badge fallback

- **WHEN** a scan runs in inventory mode and tradability cannot be determined
- **THEN** the scan aborts with an explicit error rather than falling back to badge pages

#### Scenario: Badge-page mode unchanged when inventory scan disabled

- **WHEN** a scan runs with inventory scan disabled (badges mode, no active scan filters)
- **THEN** the scanner uses the badge-page flow as before
