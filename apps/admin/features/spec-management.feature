Feature: Spec Management
  As an admin user
  I want to manage AnalysisSpecs (the system's configurable behaviours)
  So that I can define measurement, identity, content, and orchestration specs

  Background:
    Given I am authenticated as an ADMIN user
    And the SpecRole taxonomy is:
      | SpecRole    | Purpose                               |
      | ORCHESTRATE | Flow/sequence control (PIPELINE-001)  |
      | EXTRACT     | Measurement and learning              |
      | SYNTHESISE  | Combine/transform data (COMP-001)     |
      | CONSTRAIN   | Bounds and guards (GUARD-001)         |
      | IDENTITY    | Agent personas (TUT-001, COACH-001)   |
      | CONTENT     | Curriculum material                   |
      | VOICE       | Voice guidance (VOICE-001)            |

  # =============================================================================
  # SPEC LISTING AND VIEWING
  # =============================================================================

  @listing
  Scenario: View all specs on the specs page
    When I navigate to /x/specs
    Then I should see a list of AnalysisSpecs
    And each spec should display:
      | field     | description              |
      | name      | Human-readable name      |
      | slug      | Unique identifier        |
      | specRole  | SpecRole badge           |
      | isActive  | Active/inactive status   |
      | scope     | SYSTEM or DOMAIN         |

  @listing
  Scenario: Filter specs by SpecRole
    Given specs exist with different SpecRoles
    When I filter by SpecRole "EXTRACT"
    Then only EXTRACT specs should be shown

  @viewing
  Scenario: View spec detail
    Given an AnalysisSpec "PERS-001" exists
    When I navigate to /x/specs/{specId}
    Then I should see the full spec configuration
    And I should see the linked BDDFeatureSet (if any)
    And I should see parameters defined by this spec

  # =============================================================================
  # SPEC CREATION (from BDD upload)
  # =============================================================================

  @creation
  Scenario: Create new spec from BDD JSON upload
    Given I navigate to /x/specs/new
    And I have a valid BDD spec JSON with:
      | field    | value       |
      | id       | NEW-SPEC-01 |
      | title    | New Spec    |
      | specRole | EXTRACT     |
    When I upload the spec
    Then an AnalysisSpec should be created in the database
    And a BDDFeatureSet should be created
    And the spec should have isActive = true

  @creation
  Scenario: Update existing spec (version increment)
    Given an AnalysisSpec "EXISTING-001" exists with version "1.5"
    When I upload a modified BDD spec with id "EXISTING-001"
    Then the spec version should be incremented
    And the AnalysisSpec should be updated

  @creation
  Scenario: Invalid spec upload shows validation errors
    Given I have an invalid BDD spec JSON missing required fields
    When I upload the spec
    Then I should see validation errors
    And no AnalysisSpec should be created

  # =============================================================================
  # SPEC ROLE CLASSIFICATION
  # =============================================================================

  @roles
  Scenario: SpecRole is determined from declared specRole field
    Given a BDD spec declares specRole "IDENTITY"
    When the spec is processed
    Then the AnalysisSpec should have specRole = IDENTITY

  @roles
  Scenario: Legacy specs without specRole fall back to outputType
    Given a BDD spec has no specRole but has outputType "MEASURE"
    When the spec is processed
    Then the AnalysisSpec should have specRole = EXTRACT

  # =============================================================================
  # CANONICAL SPEC SLUGS (from config.specs.*)
  # =============================================================================

  @canonical
  Scenario: Six canonical spec slugs are env-overridable
    Given the config.specs registry contains:
      | config key | default slug |
      | pipeline   | PIPELINE-001 |
      | init       | INIT-001     |
      | personality| PERS-001     |
      | composition| COMP-001     |
      | guard      | GUARD-001    |
      | reward     | REW-001      |
    When the system resolves a canonical spec
    Then it should use the configured slug (not a hardcoded value)
    And each slug can be overridden via environment variable

  # =============================================================================
  # SPEC SYNC (Admin page)
  # =============================================================================

  @sync
  Scenario: Sync specs from seed JSON files
    When I navigate to /x/admin/spec-sync
    And I trigger a sync
    Then specs from docs-archive/bdd-specs/ should be compared with DB
    And new specs should be identified
    And changed specs should be highlighted with diffs
