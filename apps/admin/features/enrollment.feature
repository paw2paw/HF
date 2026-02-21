Feature: Enrollment System
  As the platform
  I want to manage caller enrolments in playbooks and cohorts
  So that learners are correctly assigned to courses and classrooms

  Background:
    Given a domain "english" exists with published playbooks
    And a CohortGroup "Year 10" exists in domain "english"
    And the CohortGroup has CohortPlaybook assignments linking it to playbooks

  # =============================================================================
  # INDIVIDUAL ENROLLMENT (CallerPlaybook)
  # =============================================================================

  @individual @critical
  Scenario: Enroll a caller in a specific playbook
    Given a caller "Alice" exists
    When enrollCaller("alice-id", "playbook-id", "manual") is called
    Then a CallerPlaybook record should be created with:
      | field      | value      |
      | callerId   | alice-id   |
      | playbookId | playbook-id|
      | status     | ACTIVE     |
      | enrolledBy | manual     |

  @individual
  Scenario: Upsert is idempotent (safe to call multiple times)
    Given Alice is already enrolled in playbook "english-basics"
    When enrollCaller() is called again for the same playbook
    Then no duplicate CallerPlaybook should be created
    And status should remain ACTIVE

  @individual
  Scenario: Re-activate a dropped enrollment
    Given Alice has a DROPPED enrollment in playbook "english-basics"
    When enrollCaller() is called for that playbook
    Then the CallerPlaybook status should change to ACTIVE
    And droppedAt should be cleared

  @individual
  Scenario: Unenroll a caller (explicit withdrawal)
    Given Alice has an ACTIVE enrollment in playbook "english-basics"
    When unenrollCaller("alice-id", "playbook-id") is called
    Then the CallerPlaybook status should change to DROPPED
    And droppedAt should be set to the current timestamp

  # =============================================================================
  # ENROLLMENT LIFECYCLE
  # =============================================================================

  @lifecycle
  Scenario: Complete an enrollment
    Given Alice has an ACTIVE enrollment
    When completeEnrollment("alice-id", "playbook-id") is called
    Then the CallerPlaybook status should change to COMPLETED
    And completedAt should be set

  @lifecycle
  Scenario: Pause an enrollment
    Given Alice has an ACTIVE enrollment
    When pauseEnrollment("alice-id", "playbook-id") is called
    Then the CallerPlaybook status should change to PAUSED
    And pausedAt should be set

  @lifecycle
  Scenario: Resume a paused enrollment
    Given Alice has a PAUSED enrollment
    When resumeEnrollment("alice-id", "playbook-id") is called
    Then the CallerPlaybook status should change to ACTIVE
    And pausedAt should be cleared

  @lifecycle
  Scenario: CallerPlaybookStatus enum values
    Then CallerPlaybookStatus should have exactly these values:
      | status    |
      | ACTIVE    |
      | COMPLETED |
      | PAUSED    |
      | DROPPED   |

  # =============================================================================
  # DOMAIN-WIDE ENROLLMENT
  # =============================================================================

  @domain
  Scenario: Auto-enroll caller in all domain playbooks
    Given domain "english" has 2 PUBLISHED playbooks
    When enrollCallerInDomainPlaybooks("alice-id", "domain-id", "auto") is called
    Then 2 CallerPlaybook records should be created
    And both should have status ACTIVE and enrolledBy "auto"

  @domain
  Scenario: Drop all active enrollments (domain switch)
    Given Alice has 3 ACTIVE enrollments
    When dropAllActiveEnrollments("alice-id") is called
    Then all 3 CallerPlaybook records should have status DROPPED
    And droppedAt should be set on all 3

  # =============================================================================
  # COHORT-LEVEL ENROLLMENT
  # =============================================================================

  @cohort @critical
  Scenario: Cohort has playbook assignments via CohortPlaybook
    Given CohortGroup "Year 10" has CohortPlaybook records linking to playbooks:
      | playbook        | assignedBy |
      | English Basics  | auto       |
      | English Advanced| manual     |
    Then getCohortPlaybookIds() should return 2 playbook IDs

  @cohort
  Scenario: Student joining cohort auto-enrolls in cohort playbooks
    Given CohortGroup "Year 10" has 2 CohortPlaybook assignments
    When a new caller joins "Year 10" via magic link
    Then the caller should have 2 CallerPlaybook records
    And enrolledBy should be "invite" or "join"

  @cohort
  Scenario: Cohort with no CohortPlaybook falls back to domain playbooks
    Given CohortGroup "Year 10" has 0 CohortPlaybook assignments
    When a new caller joins "Year 10"
    Then the caller should be enrolled in all PUBLISHED domain playbooks
    And enrolledBy should be "auto"

  # =============================================================================
  # MULTI-COHORT MEMBERSHIP (CallerCohortMembership)
  # =============================================================================

  @multi-cohort
  Scenario: Caller can belong to multiple cohorts
    Given Alice is a member of CohortGroup "Year 10 English"
    When Alice is also added to CohortGroup "Year 10 Science"
    Then Alice should have CallerCohortMembership records for both groups
    And both memberships should be active

  @multi-cohort
  Scenario: Legacy single-cohort FK is maintained for compatibility
    Given Alice has cohortGroupId set to "Year 10 English"
    Then Alice should also have a CallerCohortMembership for "Year 10 English"

  # =============================================================================
  # PLAYBOOK ROSTER
  # =============================================================================

  @roster
  Scenario: Get playbook roster
    Given 5 callers are enrolled in playbook "English Basics"
    When getPlaybookRoster("playbook-id") is called
    Then I should receive 5 CallerPlaybook records with caller details
    And results should be ordered by enrolledAt ascending

  @roster
  Scenario: Filter roster by status
    Given 3 ACTIVE and 2 DROPPED enrollments exist
    When getPlaybookRoster("playbook-id", "ACTIVE") is called
    Then I should receive only the 3 ACTIVE enrollments

  # =============================================================================
  # ENROLLMENT SOURCE TRACKING
  # =============================================================================

  @tracking
  Scenario: Enrollment source is recorded
    Then enrolledBy should track how the enrollment was created:
      | source       | meaning                         |
      | quick-launch | Created via Quick Launch wizard  |
      | invite       | Created via invite acceptance    |
      | auto         | Auto-enrolled (domain fallback)  |
      | manual       | Admin manually enrolled          |
      | migration    | Backfill from legacy system      |
