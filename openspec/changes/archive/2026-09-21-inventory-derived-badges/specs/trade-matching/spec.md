# Spec Delta

## MODIFIED Requirements

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

## ADDED Requirements

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
