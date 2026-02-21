Feature: Communities
  As an admin user
  I want to create and manage purpose-led communities
  So that groups of individuals can share a learning experience

  Background:
    Given I am authenticated as an ADMIN user
    And domains can have kind INSTITUTION or COMMUNITY

  # =============================================================================
  # COMMUNITY CREATION
  # =============================================================================

  @creation
  Scenario: Create a new community
    When I POST /api/communities with:
      """
      {
        "name": "Peer Support Network",
        "description": "A supportive learning community",
        "slug": "peer-support"
      }
      """
    Then a Domain should be created with:
      | field       | value                   |
      | name        | Peer Support Network    |
      | slug        | peer-support            |
      | kind        | COMMUNITY               |
      | isActive    | true                    |

  @creation
  Scenario: Community slug must be unique
    Given a community with slug "peer-support" already exists
    When I try to create another community with slug "peer-support"
    Then the response should be 400 with a uniqueness error

  # =============================================================================
  # COMMUNITY LISTING
  # =============================================================================

  @listing
  Scenario: List all communities
    Given 3 communities exist
    When I GET /api/communities
    Then I should receive 3 communities
    And each community should include name, slug, description, isActive
    And communities should include member count

  @listing
  Scenario: View community detail
    Given a community "Peer Support Network" exists with id "comm-123"
    When I GET /api/communities/comm-123
    Then I should receive the community details
    And the response should include member list

  # =============================================================================
  # COMMUNITY MANAGEMENT
  # =============================================================================

  @management
  Scenario: Update community details
    Given a community exists with id "comm-123"
    When I PATCH /api/communities/comm-123 with name "Updated Network"
    Then the community name should be updated

  @management
  Scenario: Archive a community (soft delete)
    Given a community exists with id "comm-123"
    When I DELETE /api/communities/comm-123
    Then the community should be soft-deleted (archived)
    And the community should no longer appear in active listings

  # =============================================================================
  # COMMUNITY MEMBERS
  # =============================================================================

  @members
  Scenario: Add member to community
    Given a community "Peer Support" exists
    And a caller "Alice" exists
    When I add Alice to the community
    Then Alice's domainId should be set to the community domain
    And Alice should appear in the community member list

  @members
  Scenario: Remove member from community
    Given Alice is a member of community "Peer Support"
    When I remove Alice from the community
    Then Alice should no longer appear in the community member list

  # =============================================================================
  # UI PAGES
  # =============================================================================

  @ui
  Scenario: Communities listing page
    When I navigate to /x/communities
    Then I should see a list of all communities
    And I should see a "Create Community" button
    And each community card should show name, member count, and status

  @ui
  Scenario: Community detail page
    Given a community exists with members and activity
    When I navigate to /x/communities/{communityId}
    Then I should see the community dashboard
    And I should see the member roster
    And I should see recent activity

  # =============================================================================
  # AUTHORIZATION
  # =============================================================================

  @auth
  Scenario: Only ADMIN+ can create communities
    Given a user with role TESTER
    When they POST /api/communities
    Then the response should be 401 or 403

  @auth
  Scenario: Community routes require authentication
    When an unauthenticated user calls GET /api/communities
    Then the response should be 401
