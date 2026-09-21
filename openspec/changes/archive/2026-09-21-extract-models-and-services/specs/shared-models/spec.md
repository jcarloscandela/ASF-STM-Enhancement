# Spec Delta

## Purpose

Provide one canonical, typed definition of the application's domain models and Steam payload shapes so every consumer imports a single declaration instead of re-declaring equivalent interfaces per module.

## ADDED Requirements

### Requirement: One declaration site per model

The system SHALL expose a single module that is the sole declaration site for the domain models (badge, badge card, match item, match card reference, scan filter, user settings, trade params, progress radial state) and the Steam payload models (inventory description, inventory asset, inventory data, badge database entry, bot list entry, tradable flag). Every other module SHALL reference those declarations instead of declaring its own equivalent interface.

#### Scenario: Shared model declared once

- **WHEN** a model such as the inventory description, inventory data, bot entry, badge, or match item is needed by more than one module
- **THEN** it is declared exactly once in the shared model module and imported by the others

#### Scenario: No competing duplicate declaration

- **WHEN** contributors search the source for a shared model name
- **THEN** exactly one interface declaration of that model exists

### Requirement: Model changes propagate from one edit

Updating a shared model SHALL require an edit in only the shared model module, and consumers of that model SHALL keep compiling against the updated shape without re-declaring it.

#### Scenario: Adding an optional field

- **WHEN** a shared payload model gains or changes an optional field
- **THEN** the change is made only in the shared model module and existing consumers continue to typecheck

### Requirement: Existing model surface stays available

The existing exported model names and runtime shapes SHALL remain available to the scanner, the trade-offer page, and the test suites, so the refactor does not change behavior or break the bundle contract.

#### Scenario: Fixtures keep working

- **WHEN** an existing test suite imports a shared model after the refactor
- **THEN** the suite compiles and passes with the same runtime shape as before
