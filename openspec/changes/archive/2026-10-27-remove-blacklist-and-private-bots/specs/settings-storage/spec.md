# Spec Delta

## ADDED Requirements

### Requirement: Legacy blacklist and Private bots storage is discarded
On upgrade, the system SHALL remove the legacy `TempAsfStm.ASF.STM.Blacklist` and `TempAsfStm.ASF.STM.PrivateBots.v1` values from browser storage and SHALL NOT read or write either value afterward. Removing these keys SHALL NOT affect unrelated settings, bot-cache, scan-parameter, badge-card, or scan-resume data.

#### Scenario: Upgrade removes obsolete state only
- **WHEN** an installed user loads the updated userscript with blacklist or Private bots data stored
- **THEN** both obsolete keys are removed, neither dataset affects the scan, and unrelated stored data remains available

## MODIFIED Requirements

### Requirement: Reset restores defaults and clears stored values

The system SHALL, on reset, delete the known reset-managed values (`TempAsfStm.ASF.STM.Settings`, `.Params`, `.BotCache`) and restore in-memory settings to their defaults. Blacklist and Private bots data are not part of reset-managed state because upgrade migration removes their legacy keys.

#### Scenario: Reset clears everything

- **WHEN** the user confirms "restore default settings"
- **THEN** the Settings, Params, and BotCache keys are removed, in-memory settings equal the defaults, and the next scan uses the inventory path

#### Scenario: Reset persists

- **WHEN** reset completes
- **THEN** the cleared/default state is saved so a subsequent reload still shows defaults
