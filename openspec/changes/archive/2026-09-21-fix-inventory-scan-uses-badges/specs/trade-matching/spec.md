# Spec Delta

## ADDED Requirements

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
