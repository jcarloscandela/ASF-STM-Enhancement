# Spec Delta

## MODIFIED Requirements

### Requirement: Inventory-mode eligibility includes badges that can complete sets

In inventory mode, the counting pass SHALL return, per card (badge appId + market hash name), both the owned copy count (all copies, trade-held included) and the currently tradable copy count. Badge eligibility SHALL treat a badge as a matching candidate when its **owned**-copy distribution is unbalanced (the even-distribution rule, with cards missing from the inventory counted as zero) **and** at least one card of the badge has at least one currently tradable copy. Badges with no tradable copies at all SHALL remain excluded, as SHALL balanced badges whose owned copies are evenly distributed.

#### Scenario: Missing-card badge with a tradable duplicate is scanned

- **WHEN** a badge has one tradable copy of Card A, no tradable copies of the remaining cards, and the user owns held copies of some of them
- **THEN** the badge is included in the candidate badge list and proceeds to per-card detail

#### Scenario: Owned-unbalanced badge with a tradable duplicate is scanned

- **WHEN** a badge's owned copies are unevenly distributed (e.g. one tradable duplicate of Card A, held copies of some other cards, and missing cards counting as zero) and at least one card has a tradable copy
- **THEN** the badge is included in the candidate badge list and proceeds to per-card detail

#### Scenario: Badge with no tradable copies stays excluded

- **WHEN** every card copy of a badge is currently trade-held
- **THEN** the badge is not included in the candidate badge list

#### Scenario: Owned-balanced badge is excluded even if tradable

- **WHEN** a badge's owned copies are evenly distributed and every copy is tradable
- **THEN** the badge is not included in the candidate badge list (nothing to match)

#### Scenario: Counting returns owned and tradable per card

- **WHEN** the inventory counting pass processes an inventory containing tradable and trade-held copies of the same card
- **THEN** the per-card result reports the total owned count (both kinds) and the currently tradable count separately

## ADDED Requirements

### Requirement: Bounded-concurrency badge-detail stage preserves per-badge semantics

The badge-detail stage SHALL run with a bounded pool of concurrent per-badge detail requests, with each next request launch separated by the web limiter. Every badge SHALL settle exactly as in a serial crawl: successful responses fill per-card details (slot order, market hashes, owned counts from the badge-detail payload, plus per-card tradable counts from the counting pass), invalid badges are marked during the crawl and filtered once every badge has settled, retryable failures consume the global error budget and retry the same badge, and non-retryable failures or an exhausted budget abort the scan. Progress and final results SHALL be identical to the serial crawl.

#### Scenario: Concurrent detail fetches produce identical results

- **WHEN** the badge-detail stage runs with several requests in flight over a badge list
- **THEN** the populated badges (cards, order, counts) and the final candidate list match what the serial crawl produces for the same inputs

#### Scenario: Invalid badges are filtered once without reordering

- **WHEN** some badges respond as invalid while other requests are still in flight
- **THEN** the invalid badges are removed from the candidate list exactly once after every badge has settled, and the order of the remaining badges is unchanged

#### Scenario: Stop during the detail stage drains cleanly

- **WHEN** the user stops the scan while detail requests are in flight
- **THEN** no further requests are scheduled and the scan terminates with the user-interrupt status

