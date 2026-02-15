Feature: Educator Studio
  As an educator
  I want a school management portal
  So that I can manage classrooms, invite students and colleagues,
  observe learning calls, and track student progress

  Background:
    Given an admin user exists
    And a domain "English" exists with active specs

  # =============================================================================
  # Onboarding
  # =============================================================================

  Scenario: Admin invites educator who accepts and sees My School
    Given the admin creates an invite with role EDUCATOR for "teacher@school.org"
    When the educator accepts the invite with firstName "Jane" lastName "Smith"
    Then a User is created with role EDUCATOR
    And a Caller is created with role TEACHER linked to that User
    And the educator sees the "My School" sidebar section with:
      | item       | icon           |
      | Dashboard  | GraduationCap  |
      | Classrooms | School         |
      | Students   | Users          |
      | Try It     | PlayCircle     |
      | Reports    | TrendingUp     |

  Scenario: Educator creates a classroom and gets a magic join link
    Given an authenticated educator exists
    When the educator creates a classroom named "Year 10 English" in domain "English"
    Then a CohortGroup is created with:
      | field     | value            |
      | name      | Year 10 English  |
      | ownerId   | educator-caller  |
      | joinToken | auto-generated   |
    And the educator receives a shareable join URL

  Scenario: Student joins via magic link and lands in sim
    Given a classroom "Year 10 English" exists with a valid joinToken
    When a new user visits /join/{joinToken}
    And submits firstName "Alice" lastName "Brown" email "alice@test.com"
    Then a User is created with role TESTER
    And a Caller is created with role LEARNER in the classroom's cohort
    And the student is auto-signed in
    And the student is redirected to /x/sim

  Scenario: Educator invites students by email
    Given an educator owns classroom "Year 10 English"
    When the educator sends invites to:
      | email              |
      | alice@test.com     |
      | bob@test.com       |
    Then 2 Invite records are created with:
      | field         | value           |
      | role          | TESTER          |
      | callerRole    | LEARNER         |
      | cohortGroupId | classroom-id    |
    And each invite has a 30-day expiry

  Scenario: Student accepts email invite and joins classroom
    Given an invite exists for "alice@test.com" with callerRole LEARNER and cohortGroupId set
    When Alice accepts the invite
    Then a User is created with role TESTER
    And a Caller is created with role LEARNER in the assigned cohort
    And Alice appears in the classroom roster

  # =============================================================================
  # Dashboard
  # =============================================================================

  Scenario: Educator views dashboard with stats
    Given an educator owns 2 classrooms with 10 total students
    And 6 students have called in the last 7 days
    When the educator visits /x/educator
    Then the dashboard shows:
      | stat              | value |
      | Classrooms        | 2     |
      | Total Students    | 10    |
      | Active This Week  | 6     |
    And recent calls are listed (most recent first)
    And students with no calls in 7+ days appear in "Needs Attention"

  Scenario: Educator views empty dashboard
    Given an educator owns no classrooms
    When the educator visits /x/educator
    Then the dashboard shows zero stats
    And quick actions are displayed including "Create Classroom"

  # =============================================================================
  # Classrooms
  # =============================================================================

  Scenario: Educator views classroom detail and roster
    Given an educator owns classroom "Year 10 English" with 3 students
    When the educator visits /x/educator/classrooms/{id}
    Then the classroom name, domain, and join link are displayed
    And the roster shows 3 students with:
      | column     | description                    |
      | Name       | student name                   |
      | Total Calls| call count                     |
      | Last Call  | most recent call date or "—"   |
      | Joined     | date joined                    |

  Scenario: Educator updates classroom name
    Given an educator owns classroom "Year 10 English"
    When the educator changes the name to "Year 11 English"
    Then the classroom name is updated to "Year 11 English"

  Scenario: Educator refreshes join link
    Given an educator owns classroom "Year 10 English" with joinToken "abc123"
    When the educator refreshes the join link
    Then a new joinToken is generated (different from "abc123")
    And the old link becomes invalid

  # =============================================================================
  # Students
  # =============================================================================

  Scenario: Educator views all students across classrooms
    Given an educator owns 2 classrooms with students in each
    When the educator visits /x/educator/students
    Then all students from both classrooms are listed
    And each row shows status:
      | condition                 | status badge |
      | Called in last 3 days     | green        |
      | Called 3-7 days ago       | amber        |
      | No calls in 7+ days      | red          |

  Scenario: Educator views student detail
    Given a student "Alice" has 5 calls and 2 active goals
    When the educator visits /x/educator/students/{id}
    Then the student profile card shows name, classroom, joined date
    And 5 calls are listed with dates
    And 2 goals are shown with progress bars

  # =============================================================================
  # Reports & Try It
  # =============================================================================

  Scenario: Educator views reports for a classroom
    Given an educator owns classroom "Year 10 English" with call activity
    When the educator visits /x/educator/reports and selects the classroom
    Then the report shows:
      | metric          | type     |
      | Total Students  | number   |
      | Total Calls     | number   |
      | Calls This Week | number   |
      | Engagement Rate | percent  |
    And a 30-day calls-per-day trend chart is displayed

  Scenario: Educator tries a call
    Given an educator owns at least one classroom
    When the educator visits /x/educator/try and starts a call
    Then the educator enters the sim experience
    And the call uses the same prompt rendering as a student call

  # =============================================================================
  # Teacher Invites (Educator → Educator)
  # =============================================================================

  Scenario: Educator invites another teacher
    Given an authenticated educator exists
    When the educator invites "colleague@school.org" as a teacher
    Then an Invite is created with:
      | field      | value    |
      | role       | EDUCATOR |
      | callerRole | TEACHER  |
    And an invite URL is returned

  Scenario: Invited teacher accepts and gets their own school
    Given an invite exists for "colleague@school.org" with role EDUCATOR
    When the colleague accepts the invite
    Then a User is created with role EDUCATOR
    And a Caller is created with role TEACHER
    And the new teacher sees "My School" with an empty dashboard
    And they can create their own classrooms independently

  Scenario: Teacher invite fails for existing user
    Given a User already exists with email "existing@school.org"
    When an educator tries to invite "existing@school.org"
    Then the response is 400 with error "User already exists"

  Scenario: Teacher invite fails for pending invite
    Given a pending invite exists for "pending@school.org"
    When an educator tries to invite "pending@school.org"
    Then the response is 400 with error "Invite already pending"

  # =============================================================================
  # Live Call Observation
  # =============================================================================

  Scenario: Teacher sees active calls for their students
    Given a student in the educator's classroom is on an active sim call
    When the educator views the students page
    Then the student's row shows a green "In Call" badge
    And the badge links to the observation page

  Scenario: Teacher observes a student call in real-time
    Given a student is on an active call with messages exchanged
    When the educator opens /x/educator/observe/{callId}
    Then the educator sees the live transcript:
      | role      | content                    |
      | assistant | Hello! How are you today?  |
      | user      | I'm good, thanks!          |
    And new messages appear within 2 seconds as the call progresses

  Scenario: Teacher interjects in a student call
    Given a teacher is observing an active student call
    When the teacher types "Great question, Alice!" and clicks Send
    Then a teacher message is created with role "teacher"
    And the student sees the message in their chat with the teacher's name
    And the AI receives the interjection as context for the next response

  Scenario: Student sees teacher interjection in their chat
    Given a student is on a call and a teacher sends an interjection
    When the student's chat polls for new messages
    Then the interjection appears as a distinct bubble (different style)
    And the bubble shows the teacher's name

  Scenario: Call ends and observation stops
    Given a teacher is observing an active call
    When the student ends the call
    Then the observation page shows "Call ended"
    And polling stops automatically

  # =============================================================================
  # Authorization
  # =============================================================================

  Scenario: Educator cannot see another educator's classrooms
    Given educator A owns classroom "Year 10"
    And educator B owns classroom "Year 11"
    When educator A calls GET /api/educator/classrooms
    Then only "Year 10" is returned
    And "Year 11" is not visible

  Scenario: Non-educator cannot access educator routes
    Given a user with role TESTER (not EDUCATOR)
    When they call GET /api/educator/dashboard
    Then the response is 401 or 403

  Scenario: Teacher can only observe students in own classrooms
    Given educator A owns a classroom with student Alice
    And educator B does not own that classroom
    When educator B tries to observe Alice's call
    Then the response is 403 Forbidden
