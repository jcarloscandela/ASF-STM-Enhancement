# Proposal

## Why

The blacklist and Private bots workflows add configuration tabs, result-row actions, persistence, and private-inventory handling that are no longer wanted. Removing them together simplifies scanning and the configuration UI, while a patch release communicates the change to existing users.

## What Changes

- **BREAKING**: Remove manual blacklist controls, the blacklist configuration tab, blacklist persistence/filtering, and automatic blacklisting of partners with private inventories.
- Remove the Private bots tab, profile backfill/list handling, and its persistence and helper module.
- Remove obsolete blacklist/private-bot test coverage and references; update the README and contributor architecture guide (`AGENTS.md`).
- Remove legacy blacklist and Private bots browser-storage data so it is no longer left behind or used by upgraded installs.
- Bump the project version at least one patch from `1.0.18` to `1.0.19` in `package.json`; preserve the existing single-source release/build flow.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `private-bots`: Remove the private-partner capture, persistence, profile-link listing, and manual cleanup behavior; the capability is retired.
- `settings-storage`: Reset and persisted-state behavior no longer includes blacklist or private-bot data; legacy keys are discarded.
- `scan-lifecycle`: Stop/persistence behavior no longer includes blacklist state, and private inventory responses no longer cause automatic blacklisting.

## Impact

- Userscript wiring in `src/ASF-STM.ts`, configuration and result-row templates, storage/settings helpers, and the `src/lib/private-bots.ts` module.
- Tests covering blacklist rendering, scan filtering/automatic blacklisting, storage/reset, and Private bots behavior.
- `README.md`, `AGENTS.md`, and the affected OpenSpec capability requirements.
- `package.json` version, which remains the source injected into the userscript build and release tag.
