Feature: System Readiness
  As an admin user
  I want to see system readiness status
  So that I know if prerequisites are met for the platform

  # =============================================================================
  # Readiness API (/api/system/readiness — public, no auth)
  # =============================================================================

  Scenario: Check system readiness - all green
    Given the database is connected
    And active AnalysisSpecs exist with compiledAt set
    And Parameters exist
    And at least one CompiledAnalysisSet has status "READY"
    And Callers, Calls, and BehaviorTargets exist
    When I call GET /api/system/readiness
    Then I should receive ready: true
    And all checks should show ok: true

  Scenario: Check system readiness - no active specs
    Given the database is connected
    And 0 AnalysisSpecs have isActive=true and compiledAt set
    When I call GET /api/system/readiness
    Then I should receive ready: false
    And the analysisSpecs check should show ok: false

  Scenario: Check system readiness - no compiled run configs
    Given the database is connected
    And active AnalysisSpecs exist
    And 0 CompiledAnalysisSets have status "READY"
    When I call GET /api/system/readiness
    Then I should receive ready: false
    And the runConfigs check should show ok: false

  Scenario: Check system readiness - no parameters
    Given the database is connected
    And 0 Parameters exist
    When I call GET /api/system/readiness
    Then the parameters check should show ok: false

  Scenario: Check system readiness - no callers
    Given the database is connected
    And 0 Callers exist
    When I call GET /api/system/readiness
    Then the callers check should show ok: false
    And suggestedActions should include "Process Transcripts"

  Scenario: Check system readiness - database error
    Given the database is not connected
    When I call GET /api/system/readiness
    Then the response status should be 500
    And I should receive ready: false
    And the database check should show ok: false

  # =============================================================================
  # Response Structure
  # =============================================================================

  Scenario: Readiness response includes all check categories
    When I call GET /api/system/readiness
    Then the response should include checks:
      | check           | fields                    |
      | database        | ok, message               |
      | analysisSpecs   | ok, count, required, link |
      | parameters      | ok, count, link           |
      | runConfigs      | ok, count, link           |
      | callers         | ok, count, link           |
      | calls           | ok, count, link           |
      | behaviorTargets | ok, count, link           |

  Scenario: Readiness response includes source status
    When I call GET /api/system/readiness
    Then the response should include sources:
      | source      | fields                     |
      | knowledge   | status, count, label, link |
      | transcripts | status, count, label, link |
      | callers     | status, count, label, link |

  Scenario: Readiness response includes stats
    When I call GET /api/system/readiness
    Then the response should include stats:
      | stat               |
      | totalCallers       |
      | totalCalls         |
      | totalMemories      |
      | analyzedCalls      |
      | callersWithPrompts |

  Scenario: Readiness response includes prioritised suggested actions
    Given some prerequisites are not met
    When I call GET /api/system/readiness
    Then the response should include suggestedActions
    And each action should have: priority, action, description
    And actions should be sorted by priority ascending

  # =============================================================================
  # Domain Readiness (separate from system readiness)
  # =============================================================================

  Scenario: Domain readiness checks spec roles
    Given a domain "english-tutor" exists with a published playbook
    When I call GET /api/domains/{domainId}/readiness
    Then readiness checks should include:
      | check             | description                                    |
      | identity_spec     | IDENTITY spec exists in playbook               |
      | content_spec      | CONTENT spec exists in playbook                |
      | pipeline_spec     | PIPELINE-001 system spec is enabled            |
      | composition_spec  | COMP-001 system spec is enabled                |
      | ai_engine         | At least one AI engine has an API key           |
      | behavior_targets  | SYSTEM-level behavior targets exist            |
