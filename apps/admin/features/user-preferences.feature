Feature: User Preferences and Multi-User Isolation
  As an authenticated user
  I want my UI preferences to be isolated from other users
  So that my customizations are preserved across sessions

  Background:
    Given the application supports multiple authenticated users
    And preferences are stored in browser localStorage
    And user session is managed by next-auth

  # =============================================================================
  # CORE ISOLATION REQUIREMENTS
  # =============================================================================

  @isolation @critical
  Scenario: User preferences are fully isolated
    Given user "alice@example.com" is logged in
    And user "alice" customizes:
      | Preference       | Value                  |
      | Chat Layout      | horizontal             |
      | Chat Mode        | DATA                   |
      | Pipeline Tabs    | [Blueprint, Inspector] |
      | Sidebar Sections | [Data, Config, Home]   |
    When user "bob@example.com" logs in on the same browser
    Then user "bob" should see all default preferences
    And user "bob" should NOT see user "alice" customizations

  @isolation @critical
  Scenario: Preferences persist across login sessions
    Given user "alice" has configured preferences
    When user "alice" logs out
    And user "alice" logs back in
    Then all preferences should be restored exactly as configured

  # =============================================================================
  # CHAT CONTEXT
  # =============================================================================

  @chat
  Scenario: Chat history is isolated per user
    Given user "alice" sends message "Hello AI" in CHAT mode
    And user "alice" sends message "Show data" in DATA mode
    When user "bob" logs in
    Then user "bob" chat history should be empty for all modes

  @chat
  Scenario: Chat settings persist per user
    Given user "alice" sets chat layout to "horizontal"
    And user "alice" sets mode to "SPEC"
    When user "alice" logs out and back in
    Then chat layout should be "horizontal"
    And chat mode should be "SPEC"

  @chat @migration
  Scenario: Legacy CALL mode migrates to CHAT
    Given user has stored mode value "CALL" from previous version
    When user loads the application
    Then the active mode should be "CHAT"

  @chat @limits
  Scenario: Chat message history is bounded
    Given user "alice" has sent 60 messages in CHAT mode
    When messages are persisted to localStorage
    Then only the 50 most recent messages should be stored

  # =============================================================================
  # DRAGGABLE TABS
  # =============================================================================

  @tabs @drag-drop
  Scenario: Tabs can be reordered via drag-and-drop
    Given user is on the Pipeline page
    And tabs are in order: Inspector, Blueprint
    When user drags "Blueprint" tab before "Inspector" tab
    Then tabs should be in order: Blueprint, Inspector
    And the new order should be persisted

  @tabs @reset
  Scenario: Reset button appears only when order is custom
    Given tabs are in default order
    Then reset button should NOT be visible
    When user reorders tabs
    Then reset button should be visible

  @tabs @reset
  Scenario: Reset button restores default order
    Given user has custom tab order: [Blueprint, Inspector]
    When user clicks reset button
    Then tabs should be in default order: [Inspector, Blueprint]
    And stored order should be cleared from localStorage
    And reset button should NOT be visible

  @tabs @dynamic
  Scenario: Dynamic tab storage keys work correctly
    Given user is viewing domain "domain-123"
    When user reorders domain detail tabs
    Then order should be stored with key "domain-detail-tabs-domain-123.{userId}"
    And this should NOT affect other domain's tab orders

  @tabs @migration
  Scenario: New tabs are appended to existing order
    Given user has stored tab order: [Tab-A, Tab-B]
    And application adds new Tab-C
    When user loads the page
    Then tabs should be in order: [Tab-A, Tab-B, Tab-C]

  @tabs @migration
  Scenario: Removed tabs are gracefully handled
    Given user has stored tab order: [Tab-A, Removed-Tab, Tab-B]
    And "Removed-Tab" no longer exists in application
    When user loads the page
    Then tabs should be in order: [Tab-A, Tab-B]

  # =============================================================================
  # SIDEBAR SECTIONS
  # =============================================================================

  @sidebar @drag-drop
  Scenario: Sidebar sections can be reordered
    Given user is on any /x/* page
    And sidebar is expanded (not collapsed)
    When user drags a section to a new position
    Then sidebar should reflect the new order
    And order should be persisted

  @sidebar @collapsed
  Scenario: Drag is disabled when sidebar is collapsed
    Given sidebar is collapsed
    Then section drag handles should be disabled

  @sidebar @reset
  Scenario: Sidebar reset restores default order
    Given user has custom sidebar order
    When user clicks sidebar reset button
    Then sidebar should be in default order

  # =============================================================================
  # ANONYMOUS USERS
  # =============================================================================

  @anonymous
  Scenario: Anonymous users can customize preferences
    Given no user is logged in (anonymous session)
    When anonymous user reorders tabs
    Then order should be stored with base key (no userId suffix)

  @anonymous
  Scenario: Anonymous and authenticated preferences are separate
    Given anonymous user has tab order [B, A]
    When user "alice" logs in
    Then user "alice" should see default order [A, B]
    When user "alice" logs out
    Then anonymous order [B, A] should be restored

  # =============================================================================
  # ERROR HANDLING
  # =============================================================================

  @error-handling
  Scenario: localStorage unavailable is handled gracefully
    Given localStorage throws QuotaExceededError
    When user tries to save preferences
    Then operation should fail silently
    And in-memory state should remain correct

  @error-handling
  Scenario: Corrupted stored data is handled
    Given localStorage contains invalid JSON for preferences
    When user loads the page
    Then default preferences should be used
    And no error should be shown to user
