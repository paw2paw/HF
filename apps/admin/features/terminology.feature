Feature: Terminology Customization
  As an institution administrator
  I want to customize the labels used throughout the platform
  So that terminology matches my organization's language (school vs corporate vs coaching)

  Background:
    Given InstitutionType records exist in the database:
      | slug       | name       | terminology.domain | terminology.playbook | terminology.caller |
      | school     | School     | School             | Course               | Student            |
      | corporate  | Corporate  | Business Unit      | Programme            | Participant        |
      | coaching   | Coaching   | Practice           | Journey              | Client             |
      | healthcare | Healthcare | Service             | Care Plan           | Patient            |
    And an Institution "Riverside School" exists with type "school"

  # =============================================================================
  # TWO-TIER RESOLUTION
  # =============================================================================

  @resolution @critical
  Scenario: ADMIN/SUPERADMIN see technical terms
    Given a user with role ADMIN
    When resolveTerminology() is called
    Then the terms should be technical (Prisma model names):
      | key      | value    |
      | domain   | Domain   |
      | playbook | Playbook |
      | spec     | Spec     |
      | caller   | Caller   |
      | cohort   | Cohort   |

  @resolution @critical
  Scenario: EDUCATOR sees institution-type terminology
    Given a user with role EDUCATOR
    And the user belongs to Institution "Riverside School" (type: school)
    When resolveTerminology() is called
    Then the terms should come from the "school" InstitutionType:
      | key        | value      |
      | domain     | School     |
      | playbook   | Course     |
      | caller     | Student    |
      | cohort     | Class      |
      | instructor | Teacher    |
      | session    | Lesson     |

  @resolution
  Scenario: STUDENT sees institution-type terminology
    Given a user with role STUDENT
    And the user belongs to an institution with type "corporate"
    When resolveTerminology() is called
    Then the terms should come from the "corporate" InstitutionType

  @resolution
  Scenario: User with no institution falls back to technical terms
    Given a user with role EDUCATOR
    And the user has no institutionId
    When resolveTerminology() is called
    Then the terms should be technical (fallback)

  # =============================================================================
  # 8 CANONICAL TERM KEYS
  # =============================================================================

  @keys
  Scenario: All 8 term keys are present in every resolution
    When resolveTerminology() is called
    Then the result should have exactly these keys:
      | key        |
      | domain     |
      | playbook   |
      | spec       |
      | caller     |
      | cohort     |
      | instructor |
      | session    |
      | persona    |

  # =============================================================================
  # HELPERS
  # =============================================================================

  @helpers
  Scenario: pluralize() creates plural form
    Given a term "School"
    When pluralize("School") is called
    Then the result should be "Schools"

  @helpers
  Scenario: lc() creates lowercase form
    Given a term "Course"
    When lc("Course") is called
    Then the result should be "course"

  @helpers
  Scenario: resolveTermLabel() returns a single term
    Given a user with role EDUCATOR in a "school" institution
    When resolveTermLabel("domain") is called
    Then the result should be "School"

  # =============================================================================
  # TERMINOLOGY API
  # =============================================================================

  @api
  Scenario: GET /api/institution/terminology returns resolved terms
    Given an authenticated EDUCATOR user in a "school" institution
    When I call GET /api/institution/terminology
    Then the response should include the full TermMap
    And the terms should match the school InstitutionType preset

  @api
  Scenario: PATCH /api/institution/terminology updates terms
    Given an authenticated ADMIN user
    When I PATCH /api/institution/terminology with:
      """
      { "domain": "Academy", "playbook": "Module" }
      """
    Then the Institution's terminology should be updated

  # =============================================================================
  # TERMINOLOGY CONTEXT (React)
  # =============================================================================

  @context
  Scenario: TerminologyContext provides terms to UI components
    Given a TerminologyContext wraps the application
    When a component calls useTerminology()
    Then it should receive the resolved TermMap
    And UI labels should use these terms (not hardcoded strings)

  @context
  Scenario: Terminology is used in educator UI
    Given a school institution with terminology.domain = "School"
    When an educator views /x/educator
    Then labels should say "School" instead of "Domain"
    And "Course" instead of "Playbook"
    And "Student" instead of "Caller"

  # =============================================================================
  # INSTITUTION TYPE MANAGEMENT
  # =============================================================================

  @admin
  Scenario: List institution types
    When I call GET /api/admin/institution-types
    Then I should receive all InstitutionType records
    And each should include slug, name, terminology JSON

  @admin
  Scenario: Create new institution type
    When I POST /api/admin/institution-types with a new type
    Then a new InstitutionType should be created
    And it should be available for new institutions

  @admin
  Scenario: InstitutionType carries wizard spec slug
    Given an InstitutionType "school" has setupSpecSlug = "COURSE-SETUP-001"
    When a new institution of type "school" is created
    Then the setup wizard should use COURSE-SETUP-001 spec

  @admin
  Scenario: InstitutionType has defaultDomainKind
    Given an InstitutionType "community" has defaultDomainKind = COMMUNITY
    When a new domain is created under a "community" institution
    Then the domain should have kind = COMMUNITY
