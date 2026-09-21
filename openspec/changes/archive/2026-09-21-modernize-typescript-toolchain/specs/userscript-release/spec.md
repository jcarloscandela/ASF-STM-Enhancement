# Spec Delta

## Purpose

Defines how the project versions itself and turns a version bump into a published GitHub release, so users can always install or update from a single trusted release page.

## ADDED Requirements

### Requirement: Version has a single source of truth

The system SHALL source the userscript version from a single declared version (`1.0.0` at the time of this change), and the build SHALL inject that version into both distributables so the shipped files, the package metadata, and the release tag always agree.

#### Scenario: Version propagates to distributables

- **WHEN** the build runs with the declared version set
- **THEN** both `dist/ASF-STM.user.js` and `dist/ASF-STM.debug.js` carry that exact version in their userscript headers

### Requirement: CI publishes a release on version bump

The system SHALL, when the declared version increases on the default branch, run the full verification pipeline and create a GitHub release named for the new version carrying both distributables as assets, ready to publish.

#### Scenario: Version bump produces release assets

- **WHEN** a commit raising the declared version lands on the default branch of the new repository
- **THEN** CI passes typecheck, lint, tests, and build, and a release for the new version exists with `ASF-STM.user.js` and `ASF-STM.debug.js` attached
