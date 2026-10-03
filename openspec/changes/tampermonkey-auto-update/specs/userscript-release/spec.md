# Spec Delta

## MODIFIED Requirements

### Requirement: CI publishes a release on version bump

The system SHALL, when the declared version increases on the default branch, run the full verification pipeline and create a published GitHub release named for the new version carrying the single distributable as its asset under a stable filename, so the always-latest release-asset download URL resolves on every version bump. The fixed file SHALL be the attached asset users auto-update to via Tampermonkey.

#### Scenario: Version bump produces release assets

- **WHEN** a commit raising the declared version lands on the default branch of the repository
- **THEN** CI passes typecheck, lint, tests, and build, and a published (not draft-only) release for the new version exists with `ASF-STM.user.js` attached under its stable filename

#### Scenario: Latest download URL serves the new version

- **WHEN** the release for a new version is published
- **THEN** fetching the always-latest release-asset download URL returns the userscript whose `@version` equals the newly declared version
