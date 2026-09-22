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

The scanner SHALL maintain, per card of the user's badges, both the owned copy count (all copies, as reported by the Steam badge page) and the currently tradable copy count (from the inventory scan when available). Set-progress decisions - badge state, set targets (`maxSets`/`lastSet`), whether a card is still needed, and the nothing-to-match badge filter - SHALL use owned counts, so a card the user already owns is never requested from a partner even when every owned copy is temporarily held. Offer decisions SHALL use tradable counts: the number of copies offered of a card SHALL NOT exceed its tradable copies in excess of the applicable set target - `surplus = max(tradable − target, 0)`, where the target is the copies the badge must retain (one for first-set completion) - so the retained copies are never offered even when further owned copies are held. A card whose tradable count does not exceed the target SHALL NOT be offered at all. When tradability is unknown, the tradable count of a card SHALL equal its owned count (badge-page fallback) and the same surplus rule SHALL apply.

#### Scenario: Owned-but-held card is not requested

- **WHEN** the user owns one copy of Card D that is temporarily trade-held, misses Cards B, C, and E, and a partner holds two copies of each card
- **THEN** no swap requests Card D; the proposed swaps only request cards with zero owned copies (B, C, and E)

#### Scenario: Offer count is capped at tradable copies

- **WHEN** the user owns five copies of Card A of which four are temporarily held (tradable = 1) and misses Cards B, C, and E
- **THEN** zero copies of Card A are offered across the badge's matches and no swap is proposed for the badge, because the single tradable copy is the retained copy and the surplus above the target is zero

#### Scenario: Fully tradable surplus fills every missing card

- **WHEN** the user owns five tradable copies of Card A, one held copy of Card D, and misses Cards B, C, and E, and a partner holds two copies of each
- **THEN** the matcher proposes exactly three swaps (A to B, A to C, A to E) and none of them requests Card D

#### Scenario: Held copies above the retained copy still yield their surplus

- **WHEN** the user owns four copies of Card A of which two are temporarily held (tradable = 2, surplus = 1 above the retained copy), one copy each of two other cards, and zero copies of the remaining cards, and a partner holds two copies of every card
- **THEN** exactly one copy of Card A is offered across the badge's matches, producing exactly one swap, and the remaining tradable copy is never offered

#### Scenario: Unknown tradability falls back to owned counts

- **WHEN** tradability data is unavailable for a badge (failed lookup or badge-page mode)
- **THEN** each card's tradable count equals its owned count, its offerable surplus equals the owned copies in excess of the applicable set target, and matching proceeds exactly as the badge-page scan always has for that owned-count distribution

#### Scenario: Fair-bot matching keeps held cards out and respects tradable capacity

- **WHEN** the user owns five tradable copies of Card A, one held copy of Card D, and zero copies of Cards B, C, and E, and a fair (non-ANY) partner holds two copies of every card
- **THEN** no proposed swap requests Card D, the total offered copies of Card A never exceed five, and every match row shows exactly the cards its generated offer will exchange

### Requirement: Match rows display only the exchanged cards

Match rows SHALL display, per side, exactly the cards the generated offer will exchange: the offered side shows the currently tradable copies that will be sent (never a held copy), and the requested side shows only cards the user does not already own within the applicable set targets.

#### Scenario: Offered icons exclude held copies

- **WHEN** a match offers one of five owned copies of Card A because four copies are held
- **THEN** the match row shows a single Card A icon on the offered side

#### Scenario: Requested icons exclude already-owned cards

- **WHEN** a partner owns two copies of Card D and the user already owns Card D
- **THEN** the requested side of the match row contains no Card D icon even though the partner could send it

### Requirement: Inventory-mode eligibility includes badges that can complete sets

In inventory mode, badge eligibility SHALL mark a badge as a matching candidate only when BOTH of the following hold: at least one receivable slot exists (a card whose owned count is below the applicable set target; missing cards count as zero owned copies) AND at least one offerable slot exists (a card whose currently tradable copies exceed the applicable set target, i.e. `max(tradable − target, 0) > 0`). A badge SHALL be excluded when it is already complete (no card below the target), when the user owns no cards of the badge, when missing cards exist but no card has tradable surplus above the target, and when every duplicate is at or below the retained target (including all-held badges). When tradability is unknown for a badge, tradable counts equal owned counts for this check.

#### Scenario: Missing-card badge with a tradable duplicate is scanned

- **WHEN** a badge is missing cards, owns at least two currently tradable copies of one card (a duplicate above the retained target), and the user owns held copies of some other cards
- **THEN** the badge is included in the candidate badge list and proceeds to bot matching

#### Scenario: Badge with no tradable copies stays excluded

- **WHEN** every card copy of a badge is currently trade-held
- **THEN** the badge is not included in the candidate badge list

#### Scenario: Last tradable copy leaves nothing to offer

- **WHEN** a badge misses cards and owns five copies of one card of which only one is currently tradable, with the applicable set target retaining one copy (surplus = 0)
- **THEN** the badge is not included in the candidate badge list and no partner check is issued for it

#### Scenario: Owned-count unbalance drives eligibility

- **WHEN** a badge's owned copies are distributed unevenly across its cards so that at least one card sits below the applicable set target and at least one duplicate sits above it (e.g. five copies of one card, one of another, none of the rest)
- **THEN** the badge is a candidate as long as the duplicate's surplus copy is currently tradable above the retained target; an uneven distribution whose duplicates are all at or below the retained target, or whose surplus is entirely held, is NOT a candidate

### Requirement: Badge detail fetches run serially and never in parallel

The badge-detail stage SHALL NOT issue parallel requests to Steam. Every `ajaxgetbadgeinfo` request SHALL run one at a time, separated from the previous request by the web limiter delay, and retryable failures SHALL retry the same badge within the global error budget under the same serial constraint before the scan aborts with the existing visible error. Invalid badges SHALL be excluded from the candidate list, and the resulting candidate list and match output SHALL be identical to a scan whose data came from the bundled dataset.

#### Scenario: Detail requests never overlap

- **WHEN** multiple candidate games require badge-detail fetches
- **THEN** each request completes or times out before the next one starts, with a web-limiter delay in between

#### Scenario: Retryable failure retries within the error budget

- **WHEN** a badge detail request fails with a retryable error while the global error budget is not exhausted
- **THEN** that badge retries after the shared retry delay, and a scan-aborting failure surfaces the existing visible error instead of being retried indefinitely

#### Scenario: Dataset-derived badges match detail-derived badges

- **WHEN** the same game is scanned once with its card list from the bundled dataset and once with a badge-detail fetch
- **THEN** both produce the same candidate badge (set size, card slots, and market hashes) and the same match output

### Requirement: Learned badge card data persists in the browser

The scanner SHALL persist every game's learned card data (set size, card titles, and per-card market hashes) to browser localStorage when it is first fetched from the badge-detail API or the remote badges database, and SHALL reuse the persisted data on every later scan instead of fetching that game again. Only games with no bundled, cached, or otherwise known card data SHALL trigger a badge-detail request. The cache SHALL be versioned so a future format change can invalidate it cleanly, and corrupt or unusable cache content SHALL be ignored without breaking the scan.

#### Scenario: Learned games are not fetched again

- **WHEN** a game's card list was learned from a badge-detail fetch in an earlier scan and the game is a candidate again
- **THEN** the later scan derives the badge from the persisted card data and issues no badge-detail request for it

#### Scenario: Only unknown games trigger detail requests

- **WHEN** a scan runs twice over the same candidate games with no bundled data for them
- **THEN** the first scan performs one serial detail fetch per game and the second scan performs none, deriving every badge from the persisted cache

#### Scenario: Corrupt cache is ignored safely

- **WHEN** the persisted card cache is missing, corrupt, or in an outdated format
- **THEN** the scan proceeds by fetching the affected games' details as if they were unknown, and never fails because of the cache

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

When the resolved scan plan is inventory mode, the scanner SHALL derive badge candidates and their card data from the fetched Steam inventory combined with its bundled dataset and the browser-persisted card cache, and SHALL NOT issue requests to the badge pages (`/badges?p=N`). One compact dataset SHALL be bundled: rich entries carrying, for the games they cover, the full per-card list (exact `market_hash_name`, display title, and icon path) with the set size, plus size-only entries carrying set sizes for the remaining games (optionally with per-card hashes). Icon paths SHALL be stored with the shared CDN prefix stripped and reconstructed at load, resolving to values identical to the full icon URLs. Badge-detail requests (`ajaxgetbadgeinfo`) SHALL be issued only for candidate games whose card list is neither bundled nor persisted in the browser cache, and only serially - one request at a time, separated by the web limiter delay; parallel badge-detail requests to Steam SHALL NOT be made. The remote badges database SHALL be fetched lazily, only when a candidate game's set size is not present in the bundled dataset or the browser cache, and it SHALL provide both set sizes and badge titles for the uncovered games it covers.

#### Scenario: Inventory mode performs no badge-page requests

- **WHEN** a scan runs with inventory mode resolved and the inventory fetch plus badges database load succeed
- **THEN** zero HTTP requests are issued to badge pages while building the candidate badge list and their card data, and badge-detail requests are issued only for games with no known card data, serially

#### Scenario: Inventory mode result matches inventory eligibility

- **WHEN** a scan runs in inventory mode over an inventory with unbalanced (duplicated/incomplete) badges
- **THEN** the candidate badge list contains exactly the eligible appIds from the inventory-to-badges-database mapping, and the scan proceeds to bot matching, deriving locally every game whose card data is bundled or cached

#### Scenario: Compact encoding resolves identical card data

- **WHEN** a candidate game's entry is stored in the compact bundled encoding (short keys, prefix-stripped icon paths)
- **THEN** the badge's card slots are derived with the exact market hashes, display titles, and full icon URLs identical to the uncompressed encoding, with no additional network request

#### Scenario: Badge-cards dataset takes precedence over the counts dataset

- **WHEN** a candidate game's data is present both as a rich entry and as a folded-in size-only entry in the single bundled dataset
- **THEN** the badge's card slots are derived from the rich entry, and the size-only entry is not consulted for that game

#### Scenario: Covered game renders complete cards on the first run

- **WHEN** a candidate game's card list is bundled in the bundled dataset and the browser cache is empty
- **THEN** the badge's card slots are derived locally with their exact market hashes, display titles, and icon URLs, no badge-detail request is issued for that game, and no request is needed to render its cards with real artwork and names

#### Scenario: Counts-only game keeps its size coverage

- **WHEN** a candidate game has a size-only entry in the bundled dataset
- **THEN** the game resolves its set size from the bundled dataset exactly as before this change, with no additional network request for the size lookup

#### Scenario: Covered game requires no badge-detail request

- **WHEN** a candidate game's card list (per-card market hashes) is present in the bundled dataset or in the browser-persisted cache
- **THEN** the badge's card slots are derived locally from that card list and the inventory counts, and no badge-detail request is issued for that game

#### Scenario: Uncovered game falls back to the serial detail request

- **WHEN** a candidate game's card list is not present in the bundled dataset or the browser cache
- **THEN** its detail is fetched with a single serial `ajaxgetbadgeinfo` request, separated from every other request by the web limiter delay, and never in parallel with another badge-detail request

#### Scenario: Set size resolves locally when covered

- **WHEN** every candidate game's set size is present in the bundled dataset
- **THEN** eligibility completes without fetching the remote badges database

#### Scenario: Uncovered set size triggers a lazy remote database fetch

- **WHEN** at least one candidate game's set size is missing from the bundled dataset and the browser cache
- **THEN** the remote badges database is fetched once for the run and provides the set sizes and badge titles of the uncovered games

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

### Requirement: Badges with no tradable path to a swap are never checked

The system SHALL determine from a badge's own slots alone — owned counts, currently tradable counts, and set targets — whether any swap is possible regardless of any partner's cards. A swap requires both a receivable card (a slot below the copies needed to complete the badge's current sets) and an offerable copy (a slot whose currently tradable copies strictly exceed the copies needed to complete the badge's current sets — the retained copies are never offerable). WHEN no such receive/offer pair can exist for any partner, the badge SHALL be treated as unable to trade. WHEN tradability is unknown for a badge, tradable capacity SHALL equal owned counts, so the check behaves exactly as the owned-count distribution requires.

#### Scenario: Complete set needs nothing

- **WHEN** the user owns exactly one copy of every card of a badge
- **THEN** the badge is unable to trade (nothing to receive) and no partner check is issued for it

#### Scenario: Empty badge needs nothing offerable

- **WHEN** the user owns zero copies of every card of a badge
- **THEN** the badge is unable to trade (nothing to offer) and no partner check is issued for it

#### Scenario: Incomplete badge without duplicates needs nothing offerable

- **WHEN** the user owns single copies of some cards of a badge and zero of the rest (e.g. one copy each of three cards, zero of two)
- **THEN** the badge is unable to trade (nothing to offer) and no partner check is issued for it

#### Scenario: Complete badge with a single spare needs nothing receivable

- **WHEN** the user owns a complete set plus exactly one spare copy (e.g. two copies of one card, one of each remaining card)
- **THEN** the badge is unable to trade (nothing to receive) and no partner check is issued for it

#### Scenario: Duplicate with gaps is checked

- **WHEN** the user owns two currently tradable copies of one card - a spare above the retained copy - and misses other cards of the badge (e.g. two copies of one card, one of two others, zero of two)
- **THEN** the badge is able to trade and partner checks are issued for it

#### Scenario: Extra spare toward a further set is checked

- **WHEN** the user owns a complete set plus more than one spare copy of a card (e.g. three copies of one card, one of each remaining card)
- **THEN** the badge is able to trade and partner checks are issued for it

#### Scenario: Trade-held duplicate removes the offer path

- **WHEN** the only spare copies above the set targets are currently trade-held (e.g. two owned copies of one card with zero tradable, single copies elsewhere, gaps unfilled)
- **THEN** the badge is unable to trade and no partner check is issued for it

#### Scenario: Single tradable copy among duplicates leaves no path

- **WHEN** the user owns two copies of one card of which only one is currently tradable (the retained copy, surplus = 0), with single or zero copies elsewhere and gaps still unfilled
- **THEN** the badge is unable to trade and no partner check is issued for it

#### Scenario: Unknown tradability falls back to owned counts

- **WHEN** tradability data is unavailable for a badge with a duplicate and gaps
- **THEN** the badge is judged by owned counts alone and partner checks are issued for it
