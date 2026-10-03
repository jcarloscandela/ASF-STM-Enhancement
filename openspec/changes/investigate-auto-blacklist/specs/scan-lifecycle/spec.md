# Spec Delta

## ADDED Requirements

### Requirement: Unreadable partner profiles skip without permanent blacklisting

The system SHALL skip a partner within the current scan when its badge page contains no readable card set (missing `.badge_card_set_cards`, e.g. private profile or friends-only inventory), advance scan progress exactly as if the partner had been checked, and continue with the next partner. The skip SHALL apply to the running scan only and SHALL NOT add the partner to the persisted blacklist.

#### Scenario: Private bot is skipped and scan continues

- **WHEN** a bot badge page returns HTTP 200 but contains no readable card set
- **THEN** the scan skips that bot, advances bot progress, and requests the next partner without aborting or handing off to matching early

#### Scenario: Skipped partner is retried on the next scan

- **WHEN** a partner was skipped as unreadable in one scan and a new scan starts
- **THEN** the partner is checked again (not treated as blacklisted) unless the user explicitly blacklisted it

#### Scenario: Friends-only inventory is skipped with a trace

- **WHEN** `matchFriends` is on and a friend's badge page is unreadable
- **THEN** the scan emits a debug trace identifying the friend as private/friends-only and skips only that friend in the running scan
