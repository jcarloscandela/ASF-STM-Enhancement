# private-bots

## Purpose

Rescue list for non-friend partners with private inventories so users can visit their Steam profiles to send friend requests manually and remove them from the blacklist.

## Requirements

### Requirement: Private partner capture at auto-blacklist time

The system SHALL record a private-partner metadata entry whenever the scanner auto-blacklists a non-friend partner for a missing card section (private profile or friends-only badges), capturing the SteamID plus the display snapshot already available (nickname, avatar hash, inventory count) with first-seen and last-seen timestamps.

#### Scenario: Auto-blacklist records metadata

- **WHEN** a bot-mode scan finds no card section on a partner badge page and pushes the SteamID to the blacklist
- **THEN** a private-partner entry for that SteamID exists with nickname, avatar hash, inventory count, and timestamps

#### Scenario: Repeated scan updates timestamps without duplicating

- **WHEN** an already-recorded private partner is auto-blacklisted again on a later scan
- **THEN** no duplicate entry is created and the last-seen timestamp advances while the earliest first-seen is kept

### Requirement: Private-partner persistence and legacy backfill

The system SHALL persist private-partner entries in browser localStorage under a versioned key so they survive reloads, SHALL ignore corrupt or version-mismatched content by starting from an empty list without throwing, and SHALL backfill display data for entries lacking nickname or avatar when the config tab opens by reusing the current bot-list cache first and fetching the Steam profile only for entries still unresolved.

#### Scenario: Entries survive reload

- **WHEN** the user reloads the page after a scan recorded private partners
- **THEN** the private list still contains the same SteamIDs with their display data

#### Scenario: Legacy blacklisted ID shows resolved name

- **WHEN** the config tab opens and a private or blacklisted entry has no nickname because it predates this feature or rotated out of the ASF list
- **THEN** the system resolves its display name from the bot cache when available, and only then fetches the Steam profile, without blocking the rest of the list on one failure

### Requirement: Private bots config tab with profile links

The system SHALL provide a `Private bots` tab in the config dialog listing every recorded non-friend private-inventory partner, where each row shows the avatar image as a link to `https://steamcommunity.com/profiles/{SteamID}`, the nickname (or SteamID fallback), the inventory count when known, and a per-row `Limpiar` button.

#### Scenario: User visits profile from the list

- **WHEN** the user clicks a partner avatar or name in the Private bots tab
- **THEN** the Steam profile for that SteamID opens (new tab) so the user can send the friend request manually in Steam

#### Scenario: Empty private list

- **WHEN** no private partners are recorded
- **THEN** the tab shows an empty state instead of rows and no fetch is issued

### Requirement: Manual-only removal that also un-blacklists

The system SHALL remove a private-partner entry only through the explicit per-row `Limpiar` action (never automatically from scan results, because blacklisted partners are skipped before any inventory fetch and the scan cannot observe them becoming public), and `Limpiar` SHALL also remove that SteamID from the blacklist when present, persist both removals, and re-render the tab without requiring a dialog save.

#### Scenario: Clean removes from both lists

- **WHEN** the user clicks `Limpiar` on a private partner that is also in the blacklist
- **THEN** the partner disappears from the Private bots tab AND its SteamID no longer appears in the blacklist textarea, and a subsequent scan no longer skips it for blacklist reasons

#### Scenario: No automatic cleanup after befriending

- **WHEN** a listed partner later becomes public or becomes a Steam friend outside the script
- **THEN** the entry remains in the Private bots tab until the user clicks `Limpiar`
