# Spec Delta

## MODIFIED Requirements

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
