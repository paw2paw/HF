Feature: System Readiness
  As an admin user
  I want to see system readiness status
  So that I know if prerequisites are met for analysis

  # =============================================================================
  # Readiness API
  # =============================================================================

  Scenario: Check system readiness - all green
    Given the database is connected
    And 5 Parameters exist
    And 3 AnalysisSpecs exist (at least 1 active)
    And 2 RunConfigs are compiled
    When I call GET /api/system/readiness
    Then I should receive ready: true
    And all checks should show ok: true

  Scenario: Check system readiness - missing parameters
    Given the database is connected
    And 0 Parameters exist
    When I call GET /api/system/readiness
    Then I should receive ready: false
    And the parameters check should show ok: false
    And I should see a suggested action to create parameters

  Scenario: Check system readiness - missing analysis specs
    Given the database is connected
    And 5 Parameters exist
    And 0 AnalysisSpecs exist
    When I call GET /api/system/readiness
    Then I should receive ready: false
    And the analysisSpecs check should show ok: false
    And I should see a suggested action to create analysis specs

  Scenario: Check system readiness - no run configs
    Given the database is connected
    And Parameters and AnalysisSpecs exist
    And 0 RunConfigs are compiled
    When I call GET /api/system/readiness
    Then I should receive ready: false
    And the runConfigs check should show ok: false
    And I should see a suggested action to compile a run config

  Scenario: Check system readiness - database error
    Given the database is not connected
    When I call GET /api/system/readiness
    Then I should receive ready: false
    And the database check should show ok: false
    And I should see a suggested action to check database connection

  # =============================================================================
  # Readiness Response Structure
  # =============================================================================

  Scenario: Readiness response includes all checks
    When I call GET /api/system/readiness
    Then the response should include:
      | check          | fields                    |
      | database       | ok, message              |
      | analysisSpecs  | ok, count, required      |
      | parameters     | ok, count                |
      | runConfigs     | ok, count                |
      | callers        | ok, count                |
      | calls          | ok, count                |
      | behaviorTargets| ok, count                |

  Scenario: Readiness response includes sources
    When I call GET /api/system/readiness
    Then the response should include sources:
      | source      | fields      |
      | callers     | count       |
      | calls       | count       |
      | memories    | count       |
      | runConfigs  | count       |

  Scenario: Readiness response includes suggested actions
    Given some prerequisites are not met
    When I call GET /api/system/readiness
    Then the response should include suggestedActions
    And each action should have: label, href, priority, context

  # =============================================================================
  # UI Integration
  # =============================================================================

  Scenario: Analyze page displays readiness status
    Given the system is not ready (missing run configs)
    When I navigate to /analyze
    Then I should see a "Prerequisites" section
    And RunConfigs should show a red indicator
    And I should see a link to create a run config

  Scenario: Analyze page allows proceeding when ready
    Given the system is fully ready
    When I navigate to /analyze
    Then the "Prerequisites" section should show all green
    And I should be able to proceed with analysis
