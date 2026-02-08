Feature: BDD Spec Upload
  As a playbook designer
  I want to upload BDD specs through the Studio
  So that I can define new analysis behaviors for the AI system

  Background:
    Given I am authenticated as a playbook designer
    And the Studio page is loaded

  # =============================================================================
  # UPLOAD PREVIEW
  # =============================================================================

  Scenario: Preview new spec upload
    Given I have a valid BDD spec JSON file
    When I select the file for upload
    Then I should see a preview of what will be created
    And the preview should show:
      | Artifact      | Status |
      | FeatureSet    | NEW    |
      | AnalysisSpec  | NEW    |
    And the preview should show the spec metadata:
      | Field      | Value        |
      | ID         | my-spec-001  |
      | Title      | My New Spec  |
      | Type       | DOMAIN       |
      | OutputType | MEASURE      |

  Scenario: Preview update to existing spec
    Given a spec with ID "existing-spec" already exists with version "1.5"
    And I have a modified BDD spec JSON with ID "existing-spec"
    When I select the file for upload
    Then I should see a preview showing:
      | Artifact      | Status | Current Version | New Version |
      | FeatureSet    | UPDATE | 1.5             | 1.6         |
      | AnalysisSpec  | UPDATE | -               | -           |
    And I should see a warning "This spec is currently active. Updating will affect live behavior."

  Scenario: Preview SYSTEM scope spec
    Given I have a BDD spec with specType "SYSTEM"
    When I select the file for upload
    Then I should see a warning "SYSTEM specs are auto-included in all playbooks."
    And the preview should show scope as "SYSTEM"

  Scenario: Preview with parameter changes
    Given I have a BDD spec with 3 parameters
    And 1 parameter already exists in the system
    When I select the file for upload
    Then the preview should show parameter summary:
      | Total | New | Updated |
      | 3     | 2   | 1       |

  Scenario: Preview invalid spec
    Given I have an invalid BDD spec JSON missing required fields
    When I select the file for upload
    Then I should see validation errors
    And the "Confirm & Activate" button should be disabled

  # =============================================================================
  # SPEC ACTIVATION
  # =============================================================================

  Scenario: Activate new spec
    Given I have previewed a valid new spec
    When I click "Confirm & Activate"
    Then the spec should be created in the database
    And I should see a success message
    And I should see the activated spec details:
      | Field | Value              |
      | Slug  | spec-my-spec-001   |
      | Name  | My New Spec        |
      | Scope | DOMAIN             |

  Scenario: Update existing spec
    Given a spec with ID "update-me" exists with version "2.0"
    And I have previewed a modified version
    When I click "Confirm & Activate"
    Then the spec version should be incremented to "2.1"
    And the AnalysisSpec should be updated
    And I should see "Spec updated and re-activated"

  Scenario: Spec is saved to bdd-specs directory
    Given I have previewed a valid spec with ID "save-test"
    When I click "Confirm & Activate"
    Then the spec JSON should be saved to "bdd-specs/save-test.spec.json"

  Scenario: Exactly one AnalysisSpec created per upload
    Given I upload a valid BDD spec
    When the upload completes
    Then exactly 1 AnalysisSpec should exist with the spec's slug
    And the AnalysisSpec should have isActive = true

  # =============================================================================
  # ADD TO PLAYBOOK (QUICK ADD)
  # =============================================================================

  Scenario: Quick add spec to draft playbook after upload
    Given I have just activated a new spec "new-feature-spec"
    And there are draft playbooks available:
      | Name            | Domain    | Status |
      | Dev Playbook    | companion | DRAFT  |
      | Test Playbook   | companion | DRAFT  |
    When I click "+ Add" on "Dev Playbook"
    Then the spec should be added to the playbook
    And the modal should close
    And I should see "Dev Playbook" in my playbooks list

  Scenario: No draft playbooks available
    Given I have just activated a new spec
    And there are no draft playbooks
    Then I should see "No draft playbooks available"
    And I should see "Specs can only be added to DRAFT playbooks"

  Scenario: Skip adding to playbook
    Given I have just activated a new spec
    When I click "Done"
    Then the modal should close
    And the spec should remain unattached to any playbook

  Scenario: View activated spec details
    Given I have just activated a new spec with ID "view-test"
    When I click "View Spec →"
    Then I should be navigated to "/x/specs/[specId]"

  # =============================================================================
  # ERROR HANDLING
  # =============================================================================

  Scenario: Handle database error during upload
    Given I have previewed a valid spec
    And the database is unavailable
    When I click "Confirm & Activate"
    Then I should see an error message "Upload failed"
    And the modal should remain open

  Scenario: Handle file system error (non-blocking)
    Given I have previewed a valid spec
    And the bdd-specs directory is not writable
    When I click "Confirm & Activate"
    Then the spec should still be created in the database
    And I should see a success message
