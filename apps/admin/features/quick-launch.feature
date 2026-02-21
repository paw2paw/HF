Feature: Quick Launch
  As an admin user
  I want to rapidly create a complete AI tutor setup from minimal input
  So that I can go from zero to a working domain in minutes

  Background:
    Given I am authenticated as an ADMIN user
    And base archetype specs exist (TUT-001, COACH-001)

  # =============================================================================
  # QUICK LAUNCH FLOW
  # =============================================================================

  @flow @critical
  Scenario: Quick Launch creates complete domain stack
    Given I navigate to /x/quick-launch
    When I provide:
      | field       | value                |
      | name        | English Literature   |
      | description | GCSE Year 10         |
    And I upload content
    And I review the AI analysis
    And I commit
    Then the following should be created:
      | artifact         |
      | Domain           |
      | IDENTITY spec    |
      | Playbook         |
      | BehaviorTargets  |
      | Onboarding config|

  # =============================================================================
  # STEP 1: ANALYZE
  # =============================================================================

  @analyze
  Scenario: AI analyzes uploaded content
    When I POST /api/domains/quick-launch/analyze with content
    Then the AI should analyze the content and return:
      | field       | description                      |
      | subjects    | Detected subjects and topics     |
      | assertions  | Extracted teaching assertions    |
      | specs       | Recommended specs for the domain |
      | name        | Suggested domain name            |

  @analyze
  Scenario: Domain name suggestion
    When I POST /api/domains/suggest-name with description "English Lit GCSE"
    Then the AI should return a suggested domain name
    And a slug suggestion

  # =============================================================================
  # STEP 2: REVIEW
  # =============================================================================

  @review
  Scenario: Review panel shows AI analysis results
    Given the analyze step has completed
    When I view the ReviewPanel
    Then I should see:
      | section       | content                         |
      | Subjects      | Extracted subject list          |
      | Assertions    | Teaching points with trust level|
      | Specs         | Recommended spec configuration  |
    And I should be able to edit each section

  # =============================================================================
  # STEP 3: COMMIT
  # =============================================================================

  @commit
  Scenario: Commit creates domain with scaffold
    When I POST /api/domains/quick-launch/commit with reviewed data
    Then the scaffold should create:
      | step | action                                      |
      | 1    | Create or reuse Domain                       |
      | 2    | Create IDENTITY spec overlay (extendsAgent)  |
      | 3    | Create and publish Playbook                  |
      | 4    | Set onboarding config from INIT-001          |
      | 5    | Create PLAYBOOK-level BehaviorTargets        |

  @commit
  Scenario: Quick Launch with existing domain
    Given domain "english" already exists
    When I commit with existingDomain = "english" and forceNewPlaybook = true
    Then a new Playbook should be created in the existing domain
    And the domain should NOT be recreated

  @commit
  Scenario: Quick Launch sets onboarding welcome message
    When the commit creates an onboarding configuration
    Then the domain should have onboardingWelcome set
    And onboardingIdentitySpecId should reference the IDENTITY spec
    And onboardingFlowPhases should be set from INIT-001 defaults

  # =============================================================================
  # UI (/x/quick-launch)
  # =============================================================================

  @ui
  Scenario: Quick Launch page flow
    When I navigate to /x/quick-launch
    Then I should see a multi-phase interface:
      | phase   | description                     |
      | Input   | Enter name and upload content    |
      | Review  | Review AI analysis results       |
      | Commit  | Confirm and create domain        |
      | Done    | Success with next steps          |

  @ui
  Scenario: Review panel allows editing before commit
    Given the AI analysis has completed
    When I view the Review panel
    Then I should be able to:
      | action                              |
      | Edit domain name                    |
      | Add or remove subjects              |
      | Edit teaching assertions            |
      | Adjust recommended specs            |

  # =============================================================================
  # AUTHORIZATION
  # =============================================================================

  @auth
  Scenario: Quick Launch routes require ADMIN role
    Then the following routes should require ADMIN auth:
      | route                              | method |
      | /api/domains/quick-launch/analyze  | POST   |
      | /api/domains/quick-launch/commit   | POST   |
      | /api/domains/suggest-name          | POST   |
