Feature: Masquerade (Step-In)
  As an ADMIN or SUPERADMIN user
  I want to temporarily impersonate another user
  So that I can see the system from their perspective for testing and support

  Background:
    Given an admin user "admin@example.com" exists with role ADMIN
    And a target user "teacher@school.org" exists with role EDUCATOR
    And a target user "student@school.org" exists with role TESTER

  # =============================================================================
  # STARTING MASQUERADE
  # =============================================================================

  @start @critical
  Scenario: Admin starts masquerading as educator
    When admin@example.com calls POST /api/admin/masquerade/start with:
      """
      { "userId": "teacher-user-id" }
      """
    Then a cookie "hf.masquerade" should be set with:
      | field           | value              |
      | userId          | teacher-user-id    |
      | email           | teacher@school.org |
      | role            | EDUCATOR           |
      | startedBy       | admin-user-id      |
    And the cookie should expire after 8 hours

  @start
  Scenario: SUPERADMIN can masquerade as any role below
    Given a SUPERADMIN user exists
    When the SUPERADMIN starts masquerading as an ADMIN
    Then the masquerade should succeed
    And requireAuth() should return the ADMIN identity

  @start
  Scenario: Cannot masquerade as equal or higher role
    Given admin@example.com has role ADMIN (level 4)
    When they try to masquerade as a SUPERADMIN (level 5)
    Then the response should be 403
    And the error should indicate role escalation is not allowed

  @start
  Scenario: Non-ADMIN users cannot masquerade
    Given a user with role EDUCATOR (level 3)
    When they try to start a masquerade
    Then the response should be 403

  # =============================================================================
  # DURING MASQUERADE
  # =============================================================================

  @active
  Scenario: requireAuth() returns masqueraded identity
    Given admin@example.com is masquerading as teacher@school.org
    When any API route calls requireAuth()
    Then the returned user should be teacher@school.org
    And the role should be EDUCATOR
    And the institutionId should be the teacher's institutionId

  @active
  Scenario: UI shows masquerade banner
    Given a masquerade is active
    When the user views any /x/* page
    Then a purple border should be shown around the page
    And a MasqueradeBanner should display:
      | field         | value                          |
      | message       | "Viewing as teacher@school.org"|
      | icon          | VenetianMask                   |
    And a "Stop" button should be visible

  @active
  Scenario: Sidebar shows masquerade user picker
    Given a masquerade is active
    When the user views the sidebar
    Then the MasqueradeUserPicker should show the impersonated user's name

  @active
  Scenario: Masquerade affects domain scoping
    Given teacher@school.org has assignedDomainId set to "english-domain"
    When admin@example.com masquerades as teacher@school.org
    Then API routes that filter by domain should use "english-domain"

  # =============================================================================
  # STOPPING MASQUERADE
  # =============================================================================

  @stop
  Scenario: Admin stops masquerade
    Given a masquerade is active
    When admin@example.com calls POST /api/admin/masquerade/stop
    Then the "hf.masquerade" cookie should be cleared
    And requireAuth() should return admin@example.com's identity

  @stop
  Scenario: Masquerade auto-expires after 8 hours
    Given a masquerade was started 9 hours ago
    When the masquerade cookie is read
    Then it should have expired (browser clears it)
    And requireAuth() should return the real user

  # =============================================================================
  # AUDIT TRAIL
  # =============================================================================

  @audit
  Scenario: Actions during masquerade include audit metadata
    Given a masquerade is active
    When an action is performed (e.g., updating a caller)
    Then getMasqueradeAuditMeta() should return:
      | field                | value              |
      | masqueradeUserId     | teacher-user-id    |
      | masqueradeUserEmail  | teacher@school.org |
      | masqueradedBy        | admin-user-id      |

  # =============================================================================
  # SPECIAL ROUTES
  # =============================================================================

  @special
  Scenario: Some routes skip masquerade (use real identity)
    Given requireAuth() is called with skipMasquerade: true
    When a masquerade is active
    Then the real admin identity should be returned (not the masqueraded one)

  # =============================================================================
  # API ROUTES
  # =============================================================================

  @api
  Scenario: Masquerade API routes exist
    Then the following routes should exist:
      | route                       | method | auth      |
      | /api/admin/masquerade/start | POST   | ADMIN+    |
      | /api/admin/masquerade/stop  | POST   | ADMIN+    |
      | /api/admin/masquerade/state | GET    | ADMIN+    |
      | /api/admin/masquerade/users | GET    | ADMIN+    |
