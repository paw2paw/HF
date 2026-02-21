Feature: Cohort Management
  As an educator or admin
  I want to manage cohort groups (classrooms)
  So that I can organize students, track activity, and view dashboards

  Background:
    Given a domain "english" exists
    And an educator owns CohortGroup "Year 10 English" in that domain

  # =============================================================================
  # COHORT API
  # =============================================================================

  @api @critical
  Scenario: Get cohort dashboard stats
    Given CohortGroup "Year 10 English" has 5 members with call activity
    When I call GET /api/cohorts/{cohortId}/dashboard
    Then the response should include:
      | field           | description                         |
      | totalMembers    | Number of callers in the cohort     |
      | activeMembersWeek| Members who called in last 7 days  |
      | totalCalls      | Total calls across all members      |
      | recentCalls     | Most recent calls list              |

  @api
  Scenario: Get cohort members
    Given CohortGroup "Year 10 English" has 5 members
    When I call GET /api/cohorts/{cohortId}/members
    Then I should receive 5 members with:
      | field      | description              |
      | id         | Caller ID                |
      | name       | Caller name              |
      | callCount  | Number of calls          |
      | lastCallAt | Most recent call date    |

  @api
  Scenario: Get cohort activity feed
    Given CohortGroup members have recent calls
    When I call GET /api/cohorts/{cohortId}/activity
    Then I should receive a chronological activity feed
    And each entry should include caller name, call date, and summary

  @api
  Scenario: Update cohort details
    When I call PATCH /api/cohorts/{cohortId} with:
      """
      { "name": "Year 11 English", "maxMembers": 35 }
      """
    Then the CohortGroup should be updated

  # =============================================================================
  # MAGIC JOIN LINK
  # =============================================================================

  @join-link @critical
  Scenario: Join link allows student self-enrollment
    Given CohortGroup "Year 10" has a joinToken
    When a new user visits /join/{joinToken}
    Then a registration form should be shown
    And submitting the form should:
      | action                              |
      | Create a User with role TESTER      |
      | Create a Caller with role LEARNER   |
      | Add caller to the CohortGroup       |
      | Enroll caller in cohort playbooks   |
      | Auto-sign in the user               |

  @join-link
  Scenario: Expired join token is rejected
    Given a CohortGroup has joinTokenExp in the past
    When a user visits /join/{joinToken}
    Then they should see "This link has expired"
    And no user should be created

  @join-link
  Scenario: Refresh join token generates new token
    Given CohortGroup has joinToken "old-token"
    When the educator refreshes the join link
    Then a new joinToken should be generated
    And "old-token" should no longer work

  @join-link
  Scenario: Join with institution branding
    Given CohortGroup has institutionId set to "riverside-school"
    And the Institution has logoUrl and primaryColor
    When a user visits /join/{joinToken}
    Then the join page should show institution branding

  # =============================================================================
  # COHORT GROUP MODEL
  # =============================================================================

  @model
  Scenario: CohortGroup schema
    Then a CohortGroup should have:
      | field         | type       | description                     |
      | id            | String     | UUID primary key                |
      | name          | String     | Group name                      |
      | description   | String?    | Optional description            |
      | domainId      | String     | Domain scope                    |
      | ownerId       | String     | Teacher/tutor Caller ID         |
      | maxMembers    | Int        | Default 50                      |
      | isActive      | Boolean    | Default true                    |
      | joinToken     | String?    | Unique magic link token         |
      | joinTokenExp  | DateTime?  | Optional expiry                 |
      | institutionId | String?    | Optional institution branding   |

  @model
  Scenario: CohortGroup has member relations
    Then a CohortGroup should have:
      | relation      | description                         |
      | members       | Legacy direct FK (Caller.cohortGroupId) |
      | memberships   | Multi-cohort join table             |
      | playbooks     | CohortPlaybook assignments          |
      | invites       | Invites linked to this cohort       |

  # =============================================================================
  # COHORT PLAYBOOK ASSIGNMENTS
  # =============================================================================

  @playbooks
  Scenario: Assign playbook to cohort
    Given Playbook "English Basics" is published
    When I assign it to CohortGroup "Year 10"
    Then a CohortPlaybook record should be created
    And new students joining "Year 10" should auto-enroll in "English Basics"

  @playbooks
  Scenario: Remove playbook from cohort
    Given CohortPlaybook links "Year 10" to "English Basics"
    When I remove the assignment
    Then the CohortPlaybook record should be deleted
    And existing CallerPlaybook records should NOT be affected

  # =============================================================================
  # AUTHORIZATION
  # =============================================================================

  @auth
  Scenario: Educator can only manage own cohorts
    Given educator A owns "Year 10"
    And educator B owns "Year 11"
    When educator A queries cohorts
    Then only "Year 10" should be returned

  @auth
  Scenario: ADMIN can manage all cohorts
    Given an ADMIN user
    When they query cohorts
    Then all CohortGroups should be returned
