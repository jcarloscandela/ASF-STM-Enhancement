# Spec Delta

## MODIFIED Requirements

### Requirement: Download contains exactly the new entries in authoring format

WHEN the enabled button is activated, the system SHALL download a file named `badge_cards.json` containing the full merged archive — every bundled dataset entry plus every new entry from the browser cache — in the authoring format (long keys `size`/`name`/`cards` with `hash`/`title`/`iconUrl` and full icon URLs), as valid JSON ready to replace `data/badge_cards.json` without manual merging. Overlaps SHALL resolve deterministically: a bundled rich entry (full card list) wins over its cache twin, a bundled size-only entry is upgraded when the cache holds its full card list, and any other bundled entry is kept verbatim.

#### Scenario: Export contains bundled entries plus new ones

- **WHEN** the bundled dataset holds games A and B and the cache adds a new game C
- **THEN** the downloaded file contains A, B, and C with the same set sizes, names, exact market hashes, display titles, and full icon URLs as their sources held

#### Scenario: Size-only bundled entry is upgraded by the cache

- **WHEN** the bundled dataset holds only a set size for a game and the cache holds its full card list
- **THEN** the downloaded file contains that game with the cached full card list

#### Scenario: Bundled rich entry wins over its cache twin

- **WHEN** a game has a full card list in both the bundled dataset and the cache
- **THEN** the downloaded file contains the bundled card list for that game, not the cached one

#### Scenario: Exported file is a drop-in archive replacement

- **WHEN** the downloaded file replaces `data/badge_cards.json` and loads through the normal dataset path
- **THEN** every game loads with the same set size, names, exact market hashes, display titles, and full icon URLs as the export held, and each subsequent export with more learned games is a superset of the previous archive

#### Scenario: Empty diff still downloads nothing

- **WHEN** zero new entries exist
- **THEN** activating the button downloads nothing and no archive file is produced
