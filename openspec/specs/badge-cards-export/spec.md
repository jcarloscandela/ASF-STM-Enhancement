# badge-cards-export Specification

## Purpose

Lets maintainers export newly learned badge-card entries from the browser cache as a merge-ready file, so each dataset release can fold real scan results into the bundled dataset.

## Requirements

### Requirement: New cache entries are detected against the bundled dataset

The system SHALL treat a cached game as new when its appId has no bundled entry, or when the bundled entry is size-only while the cache holds a full card list. A cached game fully covered by a bundled rich entry SHALL NOT count as new. Unreadable cache content SHALL be ignored exactly as the scan does.

#### Scenario: Unbundled cached game is new

- **WHEN** the cache holds a game whose appId appears nowhere in the bundled dataset
- **THEN** that game counts as a new entry

#### Scenario: Rich cache upgrades a size-only bundled entry

- **WHEN** the bundled dataset holds only a set size for a game and the cache holds its full card list
- **THEN** that game counts as a new entry

#### Scenario: Bundled rich entry suppresses its cache twin

- **WHEN** a game has a full card list in both the bundled dataset and the cache
- **THEN** that game does not count as a new entry

#### Scenario: Corrupt cache yields no new entries

- **WHEN** the badge-cards cache is missing, corrupt, or in an outdated format
- **THEN** zero games count as new entries

### Requirement: Export button reflects whether new entries exist

The system SHALL render a "Download new badge cards" button in the config dialog that is disabled when zero new entries exist and enabled when at least one exists. The state SHALL recompute when the dialog opens and after scans that learn entries.

#### Scenario: Empty diff disables the button

- **WHEN** the dialog opens with no new entries
- **THEN** the button is disabled and activating it downloads nothing

#### Scenario: Learned entries enable the button

- **WHEN** a scan learns a game not covered by the bundled dataset
- **THEN** the button becomes enabled without requiring a page reload

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

### Requirement: Export changes nothing else

The export SHALL NOT modify the browser cache, the bundled dataset, or scan behavior: after exporting, the cache reads back identical and later scans fetch and match exactly as before.

#### Scenario: Export is side-effect free

- **WHEN** the user exports and then runs another scan over the same games
- **THEN** no extra badge-detail request is issued and the match output is unchanged
