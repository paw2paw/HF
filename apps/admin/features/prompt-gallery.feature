Feature: Prompt Gallery
  As an admin user
  I want to view all callers and their prompt status
  So that I can manage and compose prompts efficiently

  Background:
    Given multiple callers exist in the system
    And some callers have composed prompts
    And some callers do not have prompts

  # =============================================================================
  # Gallery View
  # =============================================================================

  Scenario: View prompt gallery
    When I navigate to /prompts
    Then I should see a list of callers on the left side
    And I should see stats showing total callers and prompt status counts
    And I should see filter options for prompt status

  Scenario: View gallery stats
    Given 100 callers exist
    And 60 have prompts
    And 10 have stale prompts (>24h old)
    And 30 have no prompts
    When I view the gallery
    Then I should see "100 Total"
    And I should see "60 With Prompt"
    And I should see "10 Needs Update"
    And I should see "30 No Prompt"

  # =============================================================================
  # Filtering
  # =============================================================================

  Scenario: Filter by "All" callers
    When I select the "All" filter
    Then I should see all callers in the list

  Scenario: Filter by "Ready" (has prompt)
    When I select the "Ready" filter
    Then I should only see callers with composed prompts

  Scenario: Filter by "Stale" prompts
    Given some callers have prompts composed more than 24 hours ago
    When I select the "Stale" filter
    Then I should only see callers with stale prompts
    And these are candidates for re-composition

  Scenario: Filter by "None" (no prompt)
    When I select the "None" filter
    Then I should only see callers without any prompt

  # =============================================================================
  # Detail Panel
  # =============================================================================

  Scenario: Select caller to view prompt
    Given I am on the gallery page
    When I click on a caller in the list
    Then the right panel should show the caller's details
    And I should see the full prompt text
    And I should see when the prompt was composed

  Scenario: View prompt metadata
    Given I have selected a caller with a prompt
    Then I should see the prompt composition date
    And I should see the inputs used (parameter values, memories)
    And I should see the caller's segment if assigned

  Scenario: View caller with no prompt
    Given I have selected a caller without a prompt
    Then the detail panel should show "No prompt composed"
    And I should see a "Compose Prompt" button

  # =============================================================================
  # Prompt Composition
  # =============================================================================

  Scenario: Compose prompt for single caller
    Given I have selected a caller without a prompt
    When I click "Compose Prompt"
    Then a prompt should be composed for that caller
    And I should see the new prompt in the detail panel
    And the caller's status should update in the list

  Scenario: Compose all prompts
    Given multiple callers have analysis data but no prompts
    When I click "Compose All"
    Then prompts should be composed for all eligible callers
    And I should see progress updates
    And the stats should update when complete

  # =============================================================================
  # Navigation
  # =============================================================================

  Scenario: Navigate to caller profile
    Given I have selected a caller
    When I click "View Profile"
    Then I should be navigated to /callers/[id]

  Scenario: Navigate to analyze page
    Given I have selected a caller
    When I click "Analyze"
    Then I should be navigated to /analyze with the caller pre-selected
