# userscript-release

## Purpose

Defines how the project versions itself and turns a version bump into a published GitHub release, so users can always install or update from a single trusted release page.

## Requirements

### Requirement: Version has a single source of truth

The system SHALL source the userscript version from a single declared version, and the build SHALL inject that version into the single distributable so the shipped file, the package metadata, and the release tag always agree. The patch bump for this fix SHALL flow through this mechanism so Tampermonkey/GreasyFork picks up the fixed file as the new version.

#### Scenario: Version propagates to distributables

- **WHEN** the build runs with the declared version set
- **THEN** `dist/ASF-STM.user.js` carries that exact version in its userscript header

### Requirement: CI publishes a release on version bump

The system SHALL, when the declared version increases on the default branch, run the full verification pipeline and create a GitHub release named for the new version carrying the single distributable as its asset, ready to publish. The fixed file SHALL be the attached asset users reinstall or auto-update to via Tampermonkey/GreasyFork.

#### Scenario: Version bump produces release assets

- **WHEN** a commit raising the declared version lands on the default branch of the repository
- **THEN** CI passes typecheck, lint, tests, and build, and a release for the new version exists with `ASF-STM.user.js` attached
