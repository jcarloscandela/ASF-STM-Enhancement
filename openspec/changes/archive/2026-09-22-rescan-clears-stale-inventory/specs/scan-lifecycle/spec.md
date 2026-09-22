# Spec Delta

## ADDED Requirements

### Requirement: Stop invalidates the bot cache

The system SHALL discard the cached bot listing (in-memory and persisted BotCache entry) when the user stops the scan, so the next scan refetches bot data instead of matching against pre-trade inventories.

#### Scenario: Post-Stop rescan refetches bots

- **WHEN** the user presses Stop and then starts a new scan
- **THEN** the scan issues a fresh bot-listing fetch even if the previous fetch is still inside its freshness window

#### Scenario: Untouched caches survive Stop

- **WHEN** the user presses Stop
- **THEN** settings, blacklist, learned badge-card metadata, and persisted Params remain stored and usable
