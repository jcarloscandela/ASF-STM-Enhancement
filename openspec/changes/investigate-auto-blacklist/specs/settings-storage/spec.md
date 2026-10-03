# Spec Delta

## ADDED Requirements

### Requirement: Persisted blacklist only changes through explicit user action

The system SHALL mutate the persisted blacklist (`TempAsfStm.ASF.STM.Blacklist`) only through explicit user actions: the per-row blacklist button, the config-dialog blacklist textarea save, or reset-to-defaults. An automatic scan skip SHALL NOT append to the persisted blacklist and SHALL NOT trigger a blacklist write.

#### Scenario: Private-profile skip leaves persisted blacklist unchanged

- **WHEN** a scan skips a partner whose badge page is unreadable (private profile or friends-only inventory)
- **THEN** the persisted blacklist value is identical before and after the skip and no blacklist write occurs for that skip

#### Scenario: Manual blacklist actions still persist

- **WHEN** the user confirms the per-row blacklist button or saves the config dialog with edited blacklist text
- **THEN** the new entry persists to `TempAsfStm.ASF.STM.Blacklist` and survives reload

#### Scenario: Blacklist entries are deduplicated

- **WHEN** a SteamID already present in the in-memory blacklist is added again through any path
- **THEN** the blacklist contains exactly one copy of that SteamID
