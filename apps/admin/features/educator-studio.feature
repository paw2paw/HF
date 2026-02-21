Feature: Educator Studio
  As an educator
  I want a school management portal
  So that I can manage classrooms, invite students and colleagues,
  observe learning calls, and track student progress

  Background:
    Given an admin user exists
    And an Institution "Riverside School" exists with an InstitutionType "school"
    And a domain "english" exists within that institution

  # =============================================================================
  # Onboarding (Invite -> Accept -> My School)
  # =============================================================================

  @onboarding @critical
  Scenario: Admin invites educator who accepts and sees My School
    Given the admin creates an Invite with role EDUCATOR for "teacher@school.org"
    When the educator accepts the invite with firstName "Jane" lastName "Smith"
    Then a User is created with role EDUCATOR and institutionId set
    And a Caller is created with role TEACHER linked to that User
    And the educator sees the "My School" sidebar section with:
      | item       |
      | Dashboard  |
      | Classrooms |
      | Students   |
      | Try It     |
      | Reports    |

  @onboarding
  Scenario: Educator creates a classroom and gets a magic join link
    Given an authenticated educator exists
    When the educator creates a classroom named "Year 10 English" in domain "english"
    Then a CohortGroup is created with:
      | field     | value           |
      | name      | Year 10 English |
      | ownerId   | educator-caller |
      | joinToken | auto-generated  |
    And the educator receives a shareable join URL

  @onboarding
  Scenario: Student joins via magic link and lands in sim
    Given a CohortGroup "Year 10 English" exists with a valid joinToken
    When a new user visits /join/{joinToken}
    And submits firstName "Alice" lastName "Brown" email "alice@test.com"
    Then a User is created with role TESTER
    And a Caller is created with role LEARNER
    And the caller is added to the CohortGroup
    And the caller is enrolled in the cohort's playbooks via CallerPlaybook
    And the student is auto-signed in
    And the student is redirected to the sim

  @onboarding
  Scenario: Educator invites students by email
    Given an educator owns classroom "Year 10 English"
    When the educator sends invites to:
      | email          |
      | alice@test.com |
      | bob@test.com   |
    Then 2 Invite records are created with:
      | field         | value        |
      | role          | TESTER       |
      | callerRole    | LEARNER      |
      | cohortGroupId | classroom-id |
    And each invite has a 30-day expiry

  @onboarding
  Scenario: Student accepts email invite and joins classroom
    Given an Invite exists for "alice@test.com" with callerRole LEARNER and cohortGroupId set
    When Alice accepts the invite
    Then a User is created with role TESTER
    And a Caller is created with role LEARNER in the assigned CohortGroup
    And Alice is enrolled in cohort playbooks via CallerPlaybook
    And Alice appears in the classroom roster

  # =============================================================================
  # Dashboard (/x/educator)
  # =============================================================================

  @dashboard
  Scenario: Educator views dashboard with stats
    Given an educator owns 2 classrooms with 10 total students
    And 6 students have called in the last 7 days
    When the educator visits /x/educator
    Then the dashboard shows:
      | stat             | value |
      | Classrooms       | 2     |
      | Total Students   | 10    |
      | Active This Week | 6     |
    And recent calls are listed (most recent first)
    And students with no calls in 7+ days appear in "Needs Attention"

  @dashboard
  Scenario: Educator views empty dashboard
    Given an educator owns no classrooms
    When the educator visits /x/educator
    Then the dashboard shows zero stats
    And quick actions are displayed including "Create Classroom"

  # =============================================================================
  # Classrooms (/x/educator/classrooms)
  # =============================================================================

  @classrooms
  Scenario: Educator views classroom detail and roster
    Given an educator owns classroom "Year 10 English" with 3 students
    When the educator visits /x/educator/classrooms/{id}
    Then the classroom name, domain, and join link are displayed
    And the roster shows 3 students with:
      | column      | description                  |
      | Name        | student name                 |
      | Total Calls | call count                   |
      | Last Call   | most recent call date or "-" |
      | Joined      | date joined                  |

  @classrooms
  Scenario: Educator updates classroom name
    Given an educator owns classroom "Year 10 English"
    When the educator changes the name to "Year 11 English"
    Then the CohortGroup name is updated to "Year 11 English"

  @classrooms
  Scenario: Educator refreshes join link
    Given an educator owns classroom "Year 10 English" with joinToken "abc123"
    When the educator refreshes the join link
    Then a new joinToken is generated (different from "abc123")
    And the old link becomes invalid

  @classrooms
  Scenario: Educator sends artifacts to students
    Given an educator owns a classroom with student Alice
    And Alice has ConversationArtifact records
    When the educator views Alice's profile
    Then the educator can send artifacts via the SendArtifactModal

  # =============================================================================
  # Students (/x/educator/students)
  # =============================================================================

  @students
  Scenario: Educator views all students across classrooms
    Given an educator owns 2 classrooms with students in each
    When the educator visits /x/educator/students
    Then all students from both classrooms are listed
    And each row shows status:
      | condition             | status badge |
      | Called in last 3 days | green        |
      | Called 3-7 days ago   | amber        |
      | No calls in 7+ days  | red          |

  @students
  Scenario: Educator views student detail
    Given a student "Alice" has 5 calls and 2 active goals
    When the educator visits /x/educator/students/{id}
    Then the student profile card shows name, classroom, joined date
    And 5 calls are listed with dates
    And 2 goals are shown with progress bars

  @students
  Scenario: Educator views student enrollments
    Given a student "Alice" is enrolled in 2 playbooks
    When the educator visits /x/educator/students/{id}
    Then the enrollments section shows:
      | playbook  | status    |
      | English   | ACTIVE    |
      | Science   | COMPLETED |

  # =============================================================================
  # Reports (/x/educator/reports)
  # =============================================================================

  @reports
  Scenario: Educator views reports for a classroom
    Given an educator owns classroom "Year 10 English" with call activity
    When the educator visits /x/educator/reports and selects the classroom
    Then the report shows:
      | metric          | type    |
      | Total Students  | number  |
      | Total Calls     | number  |
      | Calls This Week | number  |
      | Engagement Rate | percent |
    And a 30-day calls-per-day trend chart is displayed

  # =============================================================================
  # Try It (/x/educator/try)
  # =============================================================================

  @try-it
  Scenario: Educator tries a call
    Given an educator owns at least one classroom
    When the educator visits /x/educator/try and starts a call
    Then the educator enters the sim experience
    And the call uses the same prompt rendering as a student call

  # =============================================================================
  # Teacher Invites (Educator -> Educator)
  # =============================================================================

  @invites
  Scenario: Educator invites another teacher
    Given an authenticated educator exists
    When the educator invites "colleague@school.org" as a teacher
    Then an Invite is created with:
      | field      | value    |
      | role       | EDUCATOR |
      | callerRole | TEACHER  |

  @invites
  Scenario: Invited teacher accepts and gets their own school
    Given an Invite exists for "colleague@school.org" with role EDUCATOR
    When the colleague accepts the invite
    Then a User is created with role EDUCATOR
    And a Caller is created with role TEACHER
    And the new teacher sees "My School" with an empty dashboard

  @invites
  Scenario: Teacher invite fails for existing user
    Given a User already exists with email "existing@school.org"
    When an educator tries to invite "existing@school.org"
    Then the response is 400 with error "User already exists"

  # =============================================================================
  # Active Call Observation
  # =============================================================================

  @observation
  Scenario: Teacher sees active calls for their students
    Given a student in the educator's classroom is on an active sim call
    When the educator views the students page
    Then the student's row shows a green "In Call" badge

  # =============================================================================
  # Authorization
  # =============================================================================

  @auth
  Scenario: Educator cannot see another educator's classrooms
    Given educator A owns classroom "Year 10"
    And educator B owns classroom "Year 11"
    When educator A calls GET /api/educator/classrooms
    Then only "Year 10" is returned

  @auth
  Scenario: Non-educator cannot access educator routes
    Given a user with role TESTER (not EDUCATOR)
    When they call GET /api/educator/classrooms
    Then the response is 401 or 403

  @auth
  Scenario: Educator API routes require EDUCATOR role
    Given the following API routes:
      | route                                  | method |
      | /api/educator/classrooms               | GET    |
      | /api/educator/classrooms               | POST   |
      | /api/educator/classrooms/{id}          | GET    |
      | /api/educator/classrooms/{id}          | PATCH  |
      | /api/educator/classrooms/{id}/members  | GET    |
      | /api/educator/classrooms/{id}/progress | GET    |
      | /api/educator/classrooms/{id}/artifacts| GET    |
      | /api/educator/students                 | GET    |
      | /api/educator/students/{id}            | GET    |
      | /api/educator/reports                  | GET    |
      | /api/educator/active-calls             | GET    |
    Then all require at least EDUCATOR role via requireAuth()
