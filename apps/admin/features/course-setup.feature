Feature: Course Setup Wizard
  As an educator or admin
  I want to set up a new course through a guided wizard
  So that the AI tutor is properly configured for my subject

  Background:
    Given I am authenticated as an ADMIN or EDUCATOR user
    And an Institution exists with an InstitutionType
    And the InstitutionType has setupSpecSlug = "COURSE-SETUP-001"

  # =============================================================================
  # WIZARD FLOW (ORCHESTRATE spec-driven)
  # =============================================================================

  @wizard @critical
  Scenario: Course setup wizard follows spec-driven steps
    When I navigate to /x/courses and start the setup wizard
    Then the wizard should present steps driven by COURSE-SETUP-001 spec:
      | step | name          | description                         |
      | 1    | Intent        | What subject and learning goals     |
      | 2    | Content       | Upload or select content sources     |
      | 3    | Course Config | Configure agent behaviour via tuner  |
      | 4    | Students      | Assign cohorts and enroll students   |
      | 5    | Done          | Summary and launch readiness         |

  # =============================================================================
  # STEP 1: INTENT
  # =============================================================================

  @intent
  Scenario: Define course intent
    Given I am on the Intent step
    When I enter:
      | field       | value                      |
      | Subject     | English Literature         |
      | Description | GCSE English Lit Year 10   |
    Then the intent should be stored in wizard state
    And I should be able to proceed to the Content step

  # =============================================================================
  # STEP 2: CONTENT
  # =============================================================================

  @content
  Scenario: Upload content for the course
    Given I am on the Content step
    When I upload a curriculum PDF
    Then a ContentSource should be created
    And the document should be classified by DocumentType
    And I should see an extraction progress indicator

  @content
  Scenario: Select existing content sources
    Given ContentSource records already exist for this domain
    When I view the Content step
    Then I should see available content sources
    And I should be able to select existing sources instead of uploading

  # =============================================================================
  # STEP 3: COURSE CONFIG (Agent Tuner)
  # =============================================================================

  @config
  Scenario: Configure agent behaviour via AgentTuner
    Given I am on the Course Config step
    When I view the AgentTuner component
    Then I should see tuning dimensions (pills/matrices)
    And adjusting dimensions should update BehaviorTarget values
    And changes should be stored as tunerPills and behaviorTargets in wizard state

  @config
  Scenario: Select persona archetype
    Given I am on the Course Config step
    When I select persona "TUT-001" (Tutor)
    Then the persona slug should be stored in wizard state
    And the identity spec should reference TUT-001

  # =============================================================================
  # STEP 4: STUDENTS
  # =============================================================================

  @students
  Scenario: Assign cohorts to the course
    Given I am on the Students step
    And CohortGroups exist in this domain
    When I select CohortGroup "Year 10 English"
    Then the cohort should be linked to the course via CohortPlaybook
    And students in the cohort should be auto-enrolled via CallerPlaybook

  @students
  Scenario: Create new cohort during setup
    Given I am on the Students step
    When I create a new CohortGroup "Year 11 English"
    Then a CohortGroup should be created with the educator as owner
    And the cohort should be assigned to this course

  # =============================================================================
  # STEP 5: DONE (Launch)
  # =============================================================================

  @done
  Scenario: Course setup completion creates domain artifacts
    Given I have completed all wizard steps
    When the wizard commits
    Then the following should be created:
      | artifact         | description                            |
      | Domain           | If new domain needed                   |
      | IDENTITY spec    | Overlay extending chosen archetype     |
      | Playbook         | Published, linking all selected specs   |
      | CohortPlaybook   | Linking cohorts to the playbook         |
      | CallerPlaybook   | Enrolling students                     |
      | BehaviorTargets  | PLAYBOOK-level targets from tuner      |

  @done
  Scenario: Course readiness is checked after setup
    Given the course setup wizard has completed
    When the Done step renders
    Then a readiness check should run against the domain
    And any missing prerequisites should be shown

  # =============================================================================
  # DOMAIN SCAFFOLDING
  # =============================================================================

  @scaffold
  Scenario: Quick Launch creates full domain stack
    When Quick Launch commits with:
      | field       | value              |
      | domainName  | English Literature |
      | archetype   | TUT-001            |
    Then the scaffold should create:
      | artifact        | detail                                  |
      | Domain          | slug auto-generated                      |
      | IDENTITY spec   | Overlay with extendsAgent = "TUT-001"   |
      | Playbook        | Published, auto-linked specs             |
      | Onboarding      | From INIT-001 phases                    |
      | BehaviorTargets | From tuner pills / defaults             |

  @scaffold
  Scenario: Quick Launch with existing domain creates new playbook
    Given domain "english" already exists
    When Quick Launch commits with existingDomain = "english"
    Then a new Playbook should be created in the existing domain
    And the existing domain should NOT be recreated

  # =============================================================================
  # API
  # =============================================================================

  @api
  Scenario: Course setup API endpoint
    When I POST /api/courses/setup with wizard data
    Then the response should include the created domain, playbook, and spec IDs

  @api
  Scenario: Generate lesson plan
    When I POST /api/courses/generate-plan with content and intent
    Then the AI should generate a structured lesson plan
    And the plan should include learning outcomes linked to content assertions
