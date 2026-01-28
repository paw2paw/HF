Feature: Analyze Workflow
  As an admin user
  I want to analyze calls for a specific caller
  So that I can understand their personality and extract memories

  Background:
    Given the system is ready with database connected
    And at least one Parameter exists
    And at least one AnalysisSpec exists
    And at least one RunConfig is compiled

  # =============================================================================
  # STEP 1: Select Caller
  # =============================================================================

  Scenario: View caller list on analyze page
    When I navigate to /analyze
    Then I should see a list of all callers
    And each caller should display their name and call count
    And I should be able to search callers by name, email, or phone

  Scenario: Select a caller to analyze
    Given I am on the /analyze page
    When I click on a caller from the list
    Then I should see the caller's details in the selection panel
    And I should be able to proceed to Step 2

  Scenario: System shows prerequisites warning when not ready
    Given the database has no Parameters defined
    When I navigate to /analyze
    Then I should see a "Prerequisites" section with a warning
    And the "Parameters" check should show as failed
    And I should see a suggested action to create parameters

  # =============================================================================
  # STEP 2: Configure and Select Calls
  # =============================================================================

  Scenario: View available run configs
    Given I have selected a caller
    When I proceed to Step 2
    Then I should see a list of compiled RunConfigs
    And each RunConfig should show the number of MEASURE and LEARN specs

  Scenario: Select multiple calls for analysis
    Given I have selected a caller with 5 calls
    And I have selected a RunConfig
    When I view the call list
    Then I should see all 5 calls with their dates
    And I should be able to multi-select calls using checkboxes
    And I should see a "Select All" option

  Scenario: Toggle store results option
    Given I have selected calls for analysis
    When I toggle the "Store Results" checkbox
    Then the option should reflect my choice
    And this should affect whether CallScores and CallerMemories are persisted

  # =============================================================================
  # STEP 3: Run Analysis and View Results
  # =============================================================================

  Scenario: Run analysis on selected calls
    Given I have selected 3 calls and a RunConfig
    When I click "Run Analysis"
    Then I should see a loading indicator
    And analysis should be run on each selected call
    And I should see progress updates

  Scenario: View analysis results
    Given analysis has completed successfully
    Then I should see scores for each parameter
    And scores should be aggregated across all analyzed calls
    And I should see extracted memories if LEARN specs were used

  Scenario: Navigate to caller profile from results
    Given I am viewing analysis results
    When I click "View Full Profile"
    Then I should be navigated to /callers/[id]
    And I should see the caller's complete profile

  # =============================================================================
  # Error Handling
  # =============================================================================

  Scenario: Handle analysis failure gracefully
    Given I have selected calls for analysis
    And the LLM service is unavailable
    When I click "Run Analysis"
    Then I should see an error message
    And I should be able to retry the analysis

  Scenario: Handle no calls available
    Given I have selected a caller with 0 calls
    When I proceed to Step 2
    Then I should see a message "No calls available for this caller"
    And the "Run Analysis" button should be disabled
