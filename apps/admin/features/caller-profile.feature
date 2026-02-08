Feature: Caller Profile Page
  As an admin user
  I want to view a comprehensive profile for each caller
  So that I can understand their personality, memories, and prompt status

  Background:
    Given a caller "John Doe" exists with id "caller-123"
    And the caller has personality data
    And the caller has memories
    And the caller has call scores

  # =============================================================================
  # Overview Tab
  # =============================================================================

  Scenario: View caller overview
    When I navigate to /callers/caller-123
    Then I should see the caller's name "John Doe"
    And I should see their personality profile as progress bars
    And I should see a memory summary with counts by category
    And I should see recent calls

  Scenario: View personality traits
    Given the caller has openness score of 0.75
    When I view the caller profile
    Then I should see "Openness" displayed as a progress bar at 75%
    And I should see all Big 5 traits displayed

  Scenario: View caller identities
    Given the caller has 2 identities (phone numbers)
    When I view the caller profile sidebar
    Then I should see a list of 2 identities
    And each identity should show its external ID
    And I should be able to click an identity to view its prompt

  # =============================================================================
  # Calls Tab
  # =============================================================================

  Scenario: View caller's call history
    Given the caller has 10 calls
    When I click the "Calls" tab
    Then I should see a list of all 10 calls
    And each call should show date, source, and score count
    And calls should be sorted by date descending

  Scenario: View call transcript
    When I click on a specific call
    Then I should see the full transcript
    And I should see any scores associated with that call

  # =============================================================================
  # Memories Tab
  # =============================================================================

  Scenario: View caller's memories
    Given the caller has 15 memories across categories
    When I click the "Memories" tab
    Then I should see memories grouped by category (FACT, PREFERENCE, EVENT, etc.)
    And each memory should show key, value, and confidence

  Scenario: Filter memories by category
    Given the caller has 5 FACT memories and 3 PREFERENCE memories
    When I view the Memories tab
    Then I should see FACT memories grouped together
    And I should see PREFERENCE memories grouped together

  # =============================================================================
  # Scores Tab
  # =============================================================================

  Scenario: View caller's scores across calls
    Given the caller has scores for 5 parameters across 10 calls
    When I click the "Scores" tab
    Then I should see scores grouped by parameter
    And I should see the score history over time
    And I should see the parameter name and definition

  Scenario: Score visualization
    Given the caller has multiple scores for "openness"
    When I view the Scores tab
    Then I should see scores displayed with visual indicators
    And high scores (>0.7) should be highlighted green
    And low scores (<0.4) should be highlighted differently

  # =============================================================================
  # Prompt Tab
  # =============================================================================

  Scenario: View composed prompt for identity
    Given the caller has an identity with a composed prompt
    When I click the "Prompt" tab
    Then I should see the full prompt text
    And I should see when the prompt was composed
    And I should see the inputs used for composition

  Scenario: No prompt available
    Given the caller's identity has no composed prompt
    When I click the "Prompt" tab
    Then I should see a message "No prompt composed yet"
    And I should see a button to compose prompt

  Scenario: Switch between identities to view prompts
    Given the caller has 2 identities with different prompts
    When I select the second identity from the sidebar
    Then the Prompt tab should update to show that identity's prompt
