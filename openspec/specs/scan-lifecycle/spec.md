# scan-lifecycle

## Purpose

Guarantees the badge inventory scan completes on the local-data fast path when no badge-detail requests are needed, so Tampermonkey/GreasyFork users never hit the startup crash.

## Requirements

### Requirement: Zero-pending scan completes without error

The system SHALL complete the own-cards scan without throwing and without issuing badge-detail requests WHEN every badge resolves from bundled or cached card data.

#### Scenario: Fully covered badge set

- **WHEN** all badges resolve from local card data (zero pending detail fetches) under a Tampermonkey/GreasyFork install
- **THEN** the scan proceeds to filtering/sorting and downstream matching with no exception and no network badge-detail request

#### Scenario: Cancellation guard evaluated on fast path

- **WHEN** the scan takes the zero-pending early-return path
- **THEN** the cancellation guard evaluates to not-aborted and the scan completes normally

### Requirement: Partner badge checks skip badges that cannot trade

For each partner, the scanner SHALL issue a badge check only for own badges able to trade per the no-tradable-path rule. For each badge unable to trade, the scanner SHALL skip the partner badge check entirely (no page request is issued), emit a skip trace log identifying the badge, and still advance scan progress exactly as if the badge had been checked. Skipped badges SHALL NOT change the scan's match output: the matches produced SHALL be identical to a scan that checked every badge.

#### Scenario: Unmatchable badge issues no partner request

- **WHEN** an own badge is unable to trade and the scan reaches a partner
- **THEN** no badge check request is issued to that partner for the badge, and a skip trace log identifies it

#### Scenario: Skipped badge still advances progress

- **WHEN** a badge check is skipped for a partner
- **THEN** scan progress advances by the same step as a performed check, so progress completes exactly when the scan finishes

#### Scenario: Checked badges produce identical matches

- **WHEN** a scan skips every unable-to-trade badge for every partner
- **THEN** the resulting matches equal the matches of a scan that checked all badges, with no missing and no added match

#### Scenario: Skip applies uniformly across partners

- **WHEN** an own badge is unable to trade
- **THEN** the check is skipped for every partner, since the decision depends only on the own badge and never on partner data
