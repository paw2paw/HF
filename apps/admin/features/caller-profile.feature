Feature: Caller Profile
  As an admin user
  I want to view a comprehensive profile for each caller
  So that I can understand their learning progress, memories, and behaviour

  Background:
    Given a caller "John Doe" exists with id "caller-123"
    And the caller belongs to domain "english-tutor"
    And the caller has a CallerPersonalityProfile
    And the caller has CallerMemory records
    And the caller has Call records with CallScore data

  # =============================================================================
  # Tab Layout (4 consolidated tabs)
  # =============================================================================

  Scenario: Caller detail page shows 4 tabs
    When I navigate to /x/callers/caller-123
    Then I should see exactly 4 tabs:
      | tab       |
      | Calls     |
      | Profile   |
      | Assess    |
      | Artifacts |

  # =============================================================================
  # Calls Tab
  # =============================================================================

  Scenario: View caller's call history
    Given the caller has 10 calls
    When I view the "Calls" tab
    Then I should see a list of all 10 calls
    And each call should show date, source, and score count
    And calls should be sorted by date descending

  Scenario: Expand call to see detail (4 sub-tabs)
    When I click on a specific call
    Then I should see 4 call-level tabs:
      | sub-tab      |
      | Transcript   |
      | Extraction   |
      | Behaviour    |
      | Prompt       |

  Scenario: Behaviour tab shows measurements only
    Given the call has BehaviorMeasurement records
    When I view the call's "Behaviour" tab
    Then I should see measured values (not static targets)
    And a badge should show the measurement count

  # =============================================================================
  # Profile Tab
  # =============================================================================

  Scenario: View caller personality profile
    Given the caller has a CallerPersonalityProfile with parameterValues
    When I view the "Profile" tab
    Then I should see personality traits as progress bars
    And I should see a memory summary grouped by category

  Scenario: View caller memories
    Given the caller has 15 CallerMemory records across categories
    When I view the "Profile" tab
    Then I should see memories grouped by category (FACT, PREFERENCE, EVENT, CONTEXT, TOPIC, RELATION)
    And each memory should show key, value, and confidence

  Scenario: View caller domain and role
    Given the caller has role LEARNER
    And the caller belongs to domain "english-tutor"
    When I view the caller profile sidebar
    Then I should see the caller's role as "Learner"
    And I should see the domain name

  # =============================================================================
  # Assess Tab
  # =============================================================================

  Scenario: View caller assessment data
    Given the caller has scores for 5 parameters across 10 calls
    When I view the "Assess" tab
    Then I should see scores grouped by parameter
    And I should see the caller's goals with progress

  Scenario: View caller goals
    Given the caller has 3 active goals (type LEARN)
    When I view the "Assess" tab
    Then I should see goal names with progress bars (0.0-1.0)
    And I should see goal status (ACTIVE, COMPLETED, PAUSED)

  # =============================================================================
  # Artifacts Tab
  # =============================================================================

  Scenario: View conversation artifacts
    Given the caller has ConversationArtifact records
    When I view the "Artifacts" tab
    Then I should see artifacts with:
      | field      | description                          |
      | type       | SUMMARY, KEY_FACT, EXERCISE, etc.    |
      | content    | The artifact text                    |
      | trustLevel | VERIFIED, INFERRED, or UNVERIFIED    |
      | status     | PENDING, SENT, DELIVERED, READ       |

  # =============================================================================
  # Section Selector (Toggle Chips)
  # =============================================================================

  Scenario: Section selector persists to localStorage
    Given I am viewing the Profile tab
    When I toggle a section chip off
    And I navigate away and return
    Then the section chip should still be off
    And the preference should be stored in localStorage

  # =============================================================================
  # Caller API
  # =============================================================================

  Scenario: GET caller detail
    When I call GET /api/callers/caller-123
    Then the response should include:
      | field               |
      | caller              |
      | calls               |
      | personality         |
      | memories            |
      | goals               |
      | enrollments         |

  Scenario: Caller not found
    When I call GET /api/callers/nonexistent-id
    Then the response should be 404
    And the error should be "Caller not found"
