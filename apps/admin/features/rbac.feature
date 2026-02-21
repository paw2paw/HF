Feature: Role-Based Access Control (RBAC)
  As the platform
  I want to enforce role-based access on all API routes
  So that users can only access resources appropriate to their role

  Background:
    Given the role hierarchy is:
      | role          | level | description                  |
      | SUPERADMIN    | 5     | Full system access           |
      | ADMIN         | 4     | Operational admin            |
      | OPERATOR      | 3     | Kept for backward compat     |
      | EDUCATOR      | 3     | Educator portal access       |
      | SUPER_TESTER  | 2     | Enhanced testing             |
      | TESTER        | 1     | Basic testing, own data only |
      | STUDENT       | 1     | Student portal, own data     |
      | DEMO          | 0     | Guided demo, read-only       |
      | VIEWER        | 1     | Deprecated alias for TESTER  |

  # =============================================================================
  # PUBLIC ROUTES (No Auth Required)
  # =============================================================================

  @public
  Scenario: Public routes do not require authentication
    Then the following routes should be accessible without authentication:
      | route                        |
      | /api/auth/*                  |
      | /api/health                  |
      | /api/ready                   |
      | /api/system/readiness        |
      | /api/invite/*                |

  # =============================================================================
  # requireAuth() ENFORCEMENT
  # =============================================================================

  @enforcement @critical
  Scenario: All non-public API routes use requireAuth()
    Given 176+ API routes exist under /api/
    And 8 routes are public (no auth)
    Then all remaining routes must call requireAuth()
    And this is enforced by route-auth-coverage.test.ts in CI

  @enforcement
  Scenario: requireAuth() returns user with role and institution
    Given an authenticated user with role ADMIN
    When requireAuth("ADMIN") is called
    Then it should return the user object including:
      | field           |
      | id              |
      | email           |
      | role            |
      | institutionId   |
      | assignedDomainId|

  @enforcement
  Scenario: requireAuth() rejects insufficient role
    Given an authenticated user with role TESTER
    When requireAuth("ADMIN") is called
    Then an auth error should be returned
    And isAuthError() should return true

  # =============================================================================
  # ROLE-SPECIFIC ACCESS
  # =============================================================================

  @roles
  Scenario: Educator routes require EDUCATOR role
    Given the educator routes:
      | route                         |
      | /api/educator/classrooms      |
      | /api/educator/students        |
      | /api/educator/reports         |
      | /api/educator/active-calls    |
    Then all require at least EDUCATOR role

  @roles
  Scenario: Admin routes require ADMIN role
    Given the admin routes:
      | route                              |
      | /api/admin/masquerade/*            |
      | /api/admin/access-control/*        |
      | /api/admin/institution-types       |
    Then all require at least ADMIN role

  @roles
  Scenario: Sim routes require VIEWER role (lowest auth)
    Given sim access routes exist
    Then all sim routes should require at minimum VIEWER role
    And TESTER, STUDENT, and DEMO users should have access

  # =============================================================================
  # MASQUERADE INTERACTION
  # =============================================================================

  @masquerade
  Scenario: requireAuth() respects masquerade cookie
    Given an ADMIN user is masquerading as an EDUCATOR
    When requireAuth() is called
    Then the returned user should be the masqueraded EDUCATOR
    And the role should be EDUCATOR (not ADMIN)

  @masquerade
  Scenario: skipMasquerade option returns real identity
    Given a masquerade is active
    When requireAuth() is called with { skipMasquerade: true }
    Then the returned user should be the real ADMIN (not masqueraded)

  # =============================================================================
  # DOMAIN SCOPING
  # =============================================================================

  @scoping
  Scenario: TESTER sees only own domain data
    Given a TESTER user with assignedDomainId = "english-domain"
    When they query callers, calls, or playbooks
    Then only data from "english-domain" should be returned

  @scoping
  Scenario: ADMIN sees all domain data
    Given an ADMIN user with no assignedDomainId
    When they query callers, calls, or playbooks
    Then data from all domains should be returned

  @scoping
  Scenario: EDUCATOR sees only own classrooms and students
    Given an EDUCATOR user
    When they call educator routes
    Then only CohortGroups where ownerId = their Caller ID should be visible
    And only students in those cohorts should be accessible
