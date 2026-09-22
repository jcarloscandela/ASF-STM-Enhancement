# match-row

## Purpose

Guarantees a bot's match row renders completely after badge comparison: the per-game filter widget is reconciled without duplicates or null-element failures, row visibility follows the persisted checkbox state, and rendering never throws, so the partner scan chain always advances.

## Requirements

### Requirement: Rendering a match row never interrupts the scan

Rendering the match row for a bot with matches SHALL complete without throwing, and the post-render continuation SHALL always run, so the partner scan chain proceeds to the next step exactly as it does when the bot has no matches. A game whose filter entry does not yet exist SHALL be added to the filter widget and the persisted filter list, and no code path SHALL dereference a missing filter element.

#### Scenario: First match for a game renders and the scan continues

- **WHEN** a bot's badge check finishes with matches and a matched game has no entry in the filter widget yet
- **THEN** the filter entry is added, the match row is rendered, the continuation runs, and the scan proceeds to the next partner with no exception

#### Scenario: Scan chain advances identically with and without rendering

- **WHEN** the same bot scan is run with matches present and with no matches
- **THEN** in both cases the post-comparison continuation runs exactly once, so downstream partners are processed in the same order either way

### Requirement: Filter widget entries are added once and counted thereafter

For each matched game, the filter widget SHALL contain exactly one checkbox entry per appid, and the persisted filter list SHALL contain that appid at most once. When the entry already exists, rendering another match for the same game SHALL increment the entry's displayed match count and SHALL NOT append a second checkbox, a second label, or a duplicate appid to the persisted filter.

#### Scenario: Second match for the same game only increments the count

- **WHEN** a game already has a filter entry with match count 1 and another match for the same game is rendered
- **THEN** the count reads 2, exactly one checkbox with that appid exists in the widget, and the persisted filter still lists the appid once

#### Scenario: Persisted filter stays free of duplicates across matches

- **WHEN** several matches across multiple bots cover overlapping sets of games
- **THEN** the persisted filter list contains each matched appid exactly once

### Requirement: Match row visibility follows the filter checkbox state

Rendering a match row SHALL derive its visibility from the existing filter checkbox state: an unchecked checkbox hides the row, a checked checkbox shows it, and a newly added entry starts checked and visible. The checked state SHALL be honored rather than reset when further matches for the same game arrive.

#### Scenario: Unchecked game hides its row

- **WHEN** a game's filter checkbox is unchecked and another match row for that game is rendered
- **THEN** the row is hidden and the checkbox remains unchecked

#### Scenario: Checked game stays visible across repeated matches

- **WHEN** a game's filter checkbox is checked and additional matches for that game are rendered
- **THEN** each row for that game is visible and the checkbox stays checked
