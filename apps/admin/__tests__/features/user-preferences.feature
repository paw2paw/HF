Feature: User Preferences and Multi-User Isolation
  As an authenticated user
  I want my UI preferences to be isolated from other users
  So that my customizations are preserved across sessions

  Background:
    Given the application supports multiple users
    And localStorage is available

  # =============================================================================
  # CHAT CONTEXT ISOLATION
  # =============================================================================

  Scenario: Chat history is isolated per user
    Given user "alice" is logged in
    And user "alice" has sent 5 messages in CHAT mode
    When user "bob" logs in
    Then user "bob" should see an empty chat history
    And user "alice" messages should not be visible

  Scenario: Chat settings are isolated per user
    Given user "alice" has configured:
      | Setting     | Value      |
      | chatLayout  | horizontal |
      | mode        | DATA       |
    When user "bob" logs in
    Then user "bob" should see default settings:
      | Setting     | Value    |
      | chatLayout  | vertical |
      | mode        | CHAT     |

  Scenario: Chat history persists after logout and login
    Given user "alice" is logged in
    And user "alice" has sent messages:
      | Mode | Content      |
      | CHAT | Hello world  |
      | DATA | Show callers |
    When user "alice" logs out
    And user "alice" logs back in
    Then user "alice" should see their previous messages
    And CHAT mode should have "Hello world"
    And DATA mode should have "Show callers"

  Scenario: Chat messages are trimmed per mode
    Given user "alice" is logged in
    And user "alice" has sent 60 messages in CHAT mode
    When the messages are persisted
    Then only the most recent 50 messages should be stored
    And the oldest 10 messages should be discarded

  Scenario: Legacy CALL mode migrates to CHAT
    Given user "alice" has stored settings with mode "CALL"
    When user "alice" logs in
    Then the active mode should be "CHAT"

  # =============================================================================
  # DRAGGABLE TAB ORDERING
  # =============================================================================

  Scenario: Tabs can be reordered via drag-and-drop
    Given user "alice" is logged in
    And the pipeline page has tabs:
      | Order | Tab       |
      | 1     | Inspector |
      | 2     | Blueprint |
    When user "alice" drags "Blueprint" before "Inspector"
    Then the tabs should be ordered:
      | Order | Tab       |
      | 1     | Blueprint |
      | 2     | Inspector |

  Scenario: Tab order is isolated per user
    Given user "alice" has reordered pipeline tabs to ["Blueprint", "Inspector"]
    When user "bob" logs in
    Then user "bob" should see default tab order ["Inspector", "Blueprint"]

  Scenario: Tab order persists across sessions
    Given user "alice" has reordered pipeline tabs to ["Blueprint", "Inspector"]
    When user "alice" logs out
    And user "alice" logs back in
    Then the pipeline tabs should be ordered ["Blueprint", "Inspector"]

  Scenario: Reset button appears when order is customized
    Given user "alice" is logged in
    And the tabs are in default order
    Then the reset button should not be visible
    When user "alice" reorders the tabs
    Then the reset button should be visible

  Scenario: Reset button restores default order
    Given user "alice" has reordered tabs to ["c", "b", "a"]
    When user "alice" clicks the reset button
    Then the tabs should be in default order ["a", "b", "c"]
    And the reset button should not be visible
    And the stored order should be cleared

  Scenario: New tabs are appended to custom order
    Given user "alice" has stored order ["b", "a"]
    And a new tab "c" is added to the application
    When user "alice" loads the page
    Then the tabs should be ordered ["b", "a", "c"]

  Scenario: Removed tabs are ignored in stored order
    Given user "alice" has stored order ["a", "removed", "b"]
    And tab "removed" no longer exists
    When user "alice" loads the page
    Then the tabs should be ordered ["a", "b"]

  # =============================================================================
  # SIDEBAR SECTION ORDERING
  # =============================================================================

  Scenario: Sidebar sections can be reordered
    Given user "alice" is logged in
    And the sidebar shows sections:
      | Order | Section   |
      | 1     | Home      |
      | 2     | Prompts   |
      | 3     | Playbooks |
      | 4     | Data      |
    When user "alice" drags "Data" before "Prompts"
    Then the sidebar should be ordered:
      | Order | Section   |
      | 1     | Home      |
      | 2     | Data      |
      | 3     | Prompts   |
      | 4     | Playbooks |

  Scenario: Sidebar order is isolated per user
    Given user "alice" has reordered sidebar sections
    When user "bob" logs in
    Then user "bob" should see default sidebar order

  Scenario: Sidebar reset button restores defaults
    Given user "alice" has customized sidebar order
    When user "alice" clicks the sidebar reset button
    Then the sidebar should be in default order
    And the sidebar reset button should not be visible

  Scenario: Sidebar drag is disabled when collapsed
    Given user "alice" is logged in
    And the sidebar is collapsed
    Then sections should not be draggable

  # =============================================================================
  # ANONYMOUS USER FALLBACK
  # =============================================================================

  Scenario: Anonymous users can customize preferences
    Given no user is logged in
    When the user reorders tabs
    Then the order should be stored without user suffix

  Scenario: Anonymous preferences are separate from authenticated
    Given no user is logged in
    And tabs are reordered to ["b", "a"]
    When user "alice" logs in
    Then user "alice" should see default tab order
    And anonymous preferences should remain unchanged

  Scenario: Logging out shows anonymous preferences
    Given user "alice" has tab order ["c", "b", "a"]
    And anonymous users have tab order ["b", "a", "c"]
    When user "alice" logs out
    Then the tab order should be ["b", "a", "c"]

  # =============================================================================
  # STORAGE KEY PATTERNS
  # =============================================================================

  Scenario Outline: Storage keys are generated correctly
    Given user "<userId>" is logged in
    When the system generates a storage key for "<prefix>"
    Then the key should be "<expectedKey>"

    Examples:
      | userId   | prefix              | expectedKey                        |
      | user-123 | hf.chat.history     | hf.chat.history.user-123           |
      | user-456 | hf.chat.settings    | hf.chat.settings.user-456          |
      | user-789 | tab-order:pipeline  | tab-order:pipeline.user-789        |
      |          | hf.chat.history     | hf.chat.history                    |
      |          | tab-order:pipeline  | tab-order:pipeline                 |

  # =============================================================================
  # TAB STORAGE KEYS BY PAGE
  # =============================================================================

  Scenario Outline: Each page uses unique tab storage key
    Given user "alice" is logged in
    When user navigates to "<page>"
    Then the tab order should be stored with key "<storageKey>"

    Examples:
      | page                       | storageKey                          |
      | /x/pipeline                | pipeline-tabs.alice                 |
      | /x/domains (domain-1)      | domain-detail-tabs-domain-1.alice   |
      | /x/specs (spec-1)          | spec-detail-tabs-spec-1.alice       |
      | /x/import                  | import-tabs.alice                   |
      | /analysis-specs            | analysis-specs-tabs.alice           |
      | /data-dictionary           | data-dictionary-tabs.alice          |

  # =============================================================================
  # ERROR HANDLING
  # =============================================================================

  Scenario: localStorage unavailable gracefully degrades
    Given localStorage is not available
    When the user tries to reorder tabs
    Then the reorder should work in memory
    But should not throw an error

  Scenario: Corrupted stored data is handled gracefully
    Given stored preferences contain invalid JSON
    When the user loads the page
    Then default order should be used
    And no error should be shown to user
