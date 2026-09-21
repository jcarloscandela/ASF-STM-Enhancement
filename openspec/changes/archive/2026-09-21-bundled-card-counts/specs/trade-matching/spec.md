# Spec Delta

## MODIFIED Requirements

### Requirement: Inventory-mode scan derives badges from inventory only

When the resolved scan plan is inventory mode, the scanner SHALL derive badge candidates and their card data from the fetched Steam inventory combined with the bundled card-count dataset and the browser-persisted card cache, and SHALL NOT issue requests to the badge pages (`/badges?p=N`). Badge-detail requests (`ajaxgetbadgeinfo`) SHALL be issued only for candidate games whose card list is neither bundled nor persisted in the browser cache, and only serially - one request at a time, separated by the web limiter delay; parallel badge-detail requests to Steam SHALL NOT be made. The remote badges database SHALL be fetched lazily, only when a candidate game's set size is not present in the bundled dataset or the browser cache, and it SHALL provide both set sizes and badge titles for the uncovered games it covers.

#### Scenario: Inventory mode performs no badge-page requests

- **WHEN** a scan runs with inventory mode resolved and the inventory fetch plus badges database load succeed
- **THEN** zero HTTP requests are issued to badge pages while building the candidate badge list and their card data, and badge-detail requests are issued only for games with no known card data, serially

#### Scenario: Inventory mode result matches inventory eligibility

- **WHEN** a scan runs in inventory mode over an inventory with unbalanced (duplicated/incomplete) badges
- **THEN** the candidate badge list contains exactly the eligible appIds from the inventory-to-badges-database mapping, and the scan proceeds to bot matching, deriving locally every game whose card data is bundled or cached

#### Scenario: Covered game requires no badge-detail request

- **WHEN** a candidate game's card list (per-card market hashes) is present in the bundled dataset or in the browser-persisted cache
- **THEN** the badge's card slots are derived locally from that card list and the inventory counts, and no badge-detail request is issued for that game

#### Scenario: Uncovered game falls back to the serial detail request

- **WHEN** a candidate game's card list is not present in the bundled dataset
- **THEN** its detail is fetched with a single serial `ajaxgetbadgeinfo` request, separated from every other request by the web limiter delay, and never in parallel with another badge-detail request

#### Scenario: Set size resolves locally when covered

- **WHEN** every candidate game's set size is present in the bundled dataset
- **THEN** eligibility completes without fetching the remote badges database

#### Scenario: Uncovered set size triggers a lazy remote database fetch

- **WHEN** at least one candidate game's set size is missing from the bundled dataset
- **THEN** the remote badges database is fetched once for the run and provides the set sizes and badge titles of the uncovered games

## ADDED Requirements

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

## REMOVED Requirements

### Requirement: Badge detail fetches run with bounded concurrency

**Reason**: Parallel in-flight requests to Steam risk account restriction. The concurrency experiment (shipped in 1.0.12) is replaced by the bundled card dataset, which removes badge-detail requests entirely for covered games, and by a strictly serial, web-limiter-paced fallback for the rest - slower per uncovered badge but safe.

**Migration**: Replaced by "Badge detail fetches run serially and never in parallel" (above) and by "Inventory-mode scan derives badges from inventory only" (modified): games covered by the bundled card dataset issue no badge-detail requests; uncovered games fall back to the pre-1.0.12 serial, paced fetch.
