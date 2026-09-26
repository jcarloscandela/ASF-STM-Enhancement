# Spec Delta

## ADDED Requirements

### Requirement: Scan and offer tradability verdicts agree

The system SHALL apply the same currently-tradable verdict (trade-state flag AND future `Tradable After` hold check, with unparseable dates failing open to the flag verdict) to scan-inventory descriptions and to live trade-offer pool items, so a copy counted as tradable at scan time is selectable at offer time and vice versa.

#### Scenario: Scan-tradable copy is offer-selectable

- **WHEN** a card copy passes the scan-time tradability verdict
- **THEN** the same copy with the same description shape passes the offer-time verdict

#### Scenario: Future-held copy is unselectable on both paths

- **WHEN** a copy carries a future `Tradable After` date or a negative trade-state flag
- **THEN** both the scan counting pass and the offer selection treat it as not currently tradable, while scan ownership counts still include it as owned
