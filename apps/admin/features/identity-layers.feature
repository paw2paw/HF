Feature: Identity Layers
  As an admin user
  I want to compose agent identities from base archetypes and domain overlays
  So that each domain's AI agent has a customized personality built on a proven foundation

  Background:
    Given a base IDENTITY spec "TUT-001" exists (archetype: Tutor)
    And a domain overlay spec "ENGLISH-TUTOR-OVERLAY" exists with extendsAgent = "TUT-001"

  # =============================================================================
  # BASE + OVERLAY MERGE
  # =============================================================================

  @merge @critical
  Scenario: Overlay spec extends base archetype
    Given the overlay spec has extendsAgent = "TUT-001"
    When mergeIdentitySpec() is called
    Then the merged spec should contain all base parameters from TUT-001
    And overlay parameters should override matching base parameters
    And new overlay-only parameters should be added

  @merge
  Scenario: Base parameters are inherited when not overridden
    Given TUT-001 defines parameter "formality" = 0.6
    And the overlay does not define "formality"
    When the specs are merged
    Then the merged "formality" should be 0.6 (inherited from base)

  @merge
  Scenario: Overlay overrides base parameter
    Given TUT-001 defines parameter "formality" = 0.6
    And the overlay defines "formality" = 0.8
    When the specs are merged
    Then the merged "formality" should be 0.8 (overlay wins)

  @merge
  Scenario: Overlay adds new parameters
    Given TUT-001 does not define "subject_expertise"
    And the overlay defines "subject_expertise" = "English Literature"
    When the specs are merged
    Then the merged spec should include "subject_expertise" = "English Literature"

  @merge
  Scenario: Constraints are merged from both layers
    Given TUT-001 has 3 constraints
    And the overlay has 2 constraints (1 new, 1 overriding base)
    When the specs are merged
    Then the merged spec should have 4 constraints total

  # =============================================================================
  # DIFF VIEW
  # =============================================================================

  @diff
  Scenario: Compute parameter-level diff between base and overlay
    Given TUT-001 has 10 parameters
    And the overlay inherits 7, overrides 2, and adds 1
    When I call GET /api/layers/diff with base=TUT-001 and overlay=ENGLISH-TUTOR-OVERLAY
    Then the diff should classify each parameter:
      | classification | count |
      | INHERITED      | 7     |
      | OVERRIDDEN     | 2     |
      | NEW            | 1     |

  @diff
  Scenario: Diff includes stats summary
    When I call GET /api/layers/diff
    Then the response should include stats:
      | field            |
      | inherited        |
      | overridden       |
      | new              |
      | totalMerged      |
      | baseConstraints  |
      | overlayConstraints|

  # =============================================================================
  # UI: /x/layers
  # =============================================================================

  @ui
  Scenario: View identity layers page
    When I navigate to /x/layers
    Then I should see a list of IDENTITY specs with extendsAgent set
    And each overlay should show its base archetype

  @ui
  Scenario: View layer diff for a domain overlay
    Given a domain overlay extends TUT-001
    When I select the overlay on /x/layers
    Then I should see parameters classified as:
      | color  | meaning    |
      | green  | INHERITED  |
      | amber  | OVERRIDDEN |
      | blue   | NEW        |

  @ui
  Scenario: View Layers link from Domains page
    When I navigate to /x/domains and view a domain detail
    Then I should see a "View Layers" link
    And clicking it should navigate to /x/layers with the domain's overlay selected

  # =============================================================================
  # extendsAgent COLUMN
  # =============================================================================

  @schema
  Scenario: AnalysisSpec has optional extendsAgent column
    Given an AnalysisSpec with specRole = IDENTITY
    Then the extendsAgent column should accept a spec ID string (e.g., "TUT-001")
    And null means the spec is a standalone archetype (not an overlay)

  @schema
  Scenario: Overlay spec must reference a valid base
    Given an overlay spec with extendsAgent = "NONEXISTENT-001"
    When the system tries to merge
    Then an error should be raised indicating the base spec was not found

  # =============================================================================
  # API ROUTES
  # =============================================================================

  @api
  Scenario: GET /api/layers/specs returns IDENTITY specs
    When I call GET /api/layers/specs
    Then the response should include all IDENTITY specs
    And each should indicate whether it is a base archetype or overlay

  @api
  Scenario: GET /api/layers/diff returns parameter classifications
    When I call GET /api/layers/diff?base=TUT-001&overlay=ENGLISH-OVERLAY
    Then the response should include:
      | field       |
      | parameters  |
      | constraints |
      | stats       |
