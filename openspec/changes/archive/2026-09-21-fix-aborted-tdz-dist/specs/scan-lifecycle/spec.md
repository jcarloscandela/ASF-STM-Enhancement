# Spec Delta

## Purpose

Guarantees the badge inventory scan completes on the local-data fast path when no badge-detail requests are needed, so Tampermonkey/GreasyFork users never hit the startup crash.

## ADDED Requirements

### Requirement: Zero-pending scan completes without error

The system SHALL complete the own-cards scan without throwing and without issuing badge-detail requests WHEN every badge resolves from bundled or cached card data.

#### Scenario: Fully covered badge set

- **WHEN** all badges resolve from local card data (zero pending detail fetches) under a Tampermonkey/GreasyFork install
- **THEN** the scan proceeds to filtering/sorting and downstream matching with no exception and no network badge-detail request

#### Scenario: Cancellation guard evaluated on fast path

- **WHEN** the scan takes the zero-pending early-return path
- **THEN** the cancellation guard evaluates to not-aborted and the scan completes normally
