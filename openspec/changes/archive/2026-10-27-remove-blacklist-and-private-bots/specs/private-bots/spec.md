# Spec Delta

## REMOVED Requirements

### Requirement: Private partner capture at auto-blacklist time
**Reason**: Automatic blacklisting of private-inventory partners and the Private bots rescue workflow are retired.
**Migration**: Existing private-partner records are discarded during upgrade; private badge-page responses no longer create records or exclusions.

### Requirement: Private-partner persistence and legacy backfill
**Reason**: The Private bots list and its profile metadata are no longer supported.
**Migration**: Existing Private bots browser-storage data is discarded during upgrade; no profile backfill is performed.

### Requirement: Private bots config tab with profile links
**Reason**: The configuration dialog no longer needs a private-partner list.
**Migration**: Users can still open Steam profiles through the normal partner results, but the Private bots tab and its list are removed.

### Requirement: Manual-only removal that also un-blacklists
**Reason**: Neither private-partner records nor blacklist entries remain supported state.
**Migration**: The Limpiar action is removed; legacy IDs are discarded and are no longer excluded from scans.
