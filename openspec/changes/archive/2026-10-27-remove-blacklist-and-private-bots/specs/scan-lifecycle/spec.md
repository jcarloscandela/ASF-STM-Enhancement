# Spec Delta

## ADDED Requirements

### Requirement: Private partner responses are not persisted as exclusions

When a partner badge page has no card section, the system SHALL skip the remainder of that partner's badge checks for the current scan to avoid redundant requests, but SHALL NOT persist the partner as a blacklist entry or exclude it from later scans for that reason.

#### Scenario: Private partner is skipped only for the current scan

- **WHEN** a partner's badge page has no card section during a scan
- **THEN** the current scan advances to the next partner without further badge requests to that partner, and a later scan does not skip the partner because of the earlier response

#### Scenario: Friends-only badges do not create a private-bot record

- **WHEN** a friends-only partner's badge page has no card section
- **THEN** the scan records no blacklist or Private bots metadata for that partner

## MODIFIED Requirements

### Requirement: Stop invalidates the bot cache

The system SHALL discard the cached bot listing (in-memory and persisted BotCache entry) when the user stops the scan, so the next scan refetches bot data instead of matching against pre-trade inventories.

#### Scenario: Post-Stop rescan refetches bots

- **WHEN** the user presses Stop and then starts a new scan
- **THEN** the scan issues a fresh bot-listing fetch even if the previous fetch is still inside its freshness window

#### Scenario: Untouched caches survive Stop

- **WHEN** the user presses Stop
- **THEN** settings, learned badge-card metadata, and persisted Params remain stored and usable
