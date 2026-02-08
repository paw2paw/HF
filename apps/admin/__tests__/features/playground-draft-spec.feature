Feature: Playground Draft Spec Injection
  As a spec developer
  I want to test draft specs in the Playground without activating them
  So that I can validate spec behavior before going live

  Background:
    Given I am on the Playground page
    And I have selected a caller "Test Caller"
    And I have selected a playbook "Default Playbook"

  # =============================================================================
  # DRAFT SPEC INPUT
  # =============================================================================

  Scenario: Draft Spec panel is collapsed by default
    When the Playground loads
    Then the "Draft Spec" panel should be collapsed
    And I should see a "🧪 Draft Spec" header

  Scenario: Expand Draft Spec panel
    When I click on the "Draft Spec" header
    Then the panel should expand
    And I should see a textarea for JSON input
    And I should see a "Load File" button
    And I should see a "Clear" button

  Scenario: Paste valid draft spec JSON
    Given the Draft Spec panel is expanded
    When I paste valid spec JSON:
      """
      {
        "id": "draft-test",
        "title": "My Draft Spec",
        "specType": "DOMAIN"
      }
      """
    Then I should see "ACTIVE" badge on the panel
    And I should see "✓ My Draft Spec" confirmation
    And I should see "ID: draft-test • Type: DOMAIN"

  Scenario: Paste invalid JSON
    Given the Draft Spec panel is expanded
    When I paste invalid JSON "{ broken json"
    Then I should see error "Invalid JSON"
    And the "ACTIVE" badge should not appear

  Scenario: Paste JSON missing required fields
    Given the Draft Spec panel is expanded
    When I paste JSON missing id field:
      """
      {
        "title": "Missing ID"
      }
      """
    Then I should see error "Spec must have 'id' and 'title' fields"

  Scenario: Load spec from file
    Given the Draft Spec panel is expanded
    When I click "📁 Load File"
    And I select a valid .json file
    Then the textarea should be populated with the file contents
    And the spec should be validated

  Scenario: Clear draft spec
    Given I have an active draft spec
    When I click "Clear"
    Then the textarea should be empty
    And the "ACTIVE" badge should disappear

  # =============================================================================
  # PROMPT GENERATION WITH DRAFT SPEC
  # =============================================================================

  Scenario: Generate prompt includes draft spec
    Given I have an active draft spec "draft-test"
    When I click "Generate Prompt"
    Then the API request should include the draft spec
    And the draft spec should be processed by the composition pipeline

  Scenario: Draft spec overrides activated specs
    Given there is an activated spec with ID "conflict-spec"
    And I have a draft spec with ID "conflict-spec" (modified version)
    When I generate a prompt
    Then the draft spec version should be used
    And the activated version should be ignored

  Scenario: Generate prompt without draft spec
    Given the Draft Spec panel has no spec loaded
    When I click "Generate Prompt"
    Then only activated specs should be used
    And no draftSpec should be in the request body

  # =============================================================================
  # NAVIGATION TO STUDIO
  # =============================================================================

  Scenario: Navigate to Studio to activate draft spec
    Given I have validated a draft spec in Playground
    And I am satisfied with the prompt output
    When I click "Activate in Studio →"
    Then I should be navigated to "/x/studio"
    And I can upload the spec there for permanent activation

  # =============================================================================
  # DRAFT SPEC WITH PARAMETERS
  # =============================================================================

  Scenario: Draft spec with parameters shows parameter count
    Given I paste a draft spec with 5 parameters
    When the spec is validated
    Then I should see "5 parameters" in the confirmation

  Scenario: Draft spec parameters are processed
    Given I have a draft spec with behavior parameters
    When I generate a prompt
    Then the parameters should influence the prompt composition
    And the behavior targets should reflect draft spec values

  # =============================================================================
  # PERSISTENCE (SESSION ONLY)
  # =============================================================================

  Scenario: Draft spec is not persisted across page refresh
    Given I have an active draft spec
    When I refresh the page
    Then the Draft Spec textarea should be empty
    And no "ACTIVE" badge should be visible

  Scenario: Draft spec state is maintained during session
    Given I have an active draft spec
    When I change the caller selection
    And I change back to the original caller
    Then my draft spec should still be active
