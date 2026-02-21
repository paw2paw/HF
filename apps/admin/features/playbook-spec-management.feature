Feature: Playbook Spec Management
  As a playbook designer
  I want to manage specs within playbooks
  So that I can configure which behaviours and content apply to callers

  Background:
    Given I am authenticated as an ADMIN user
    And a domain "english-tutor" exists
    And AnalysisSpecs exist with SpecRole taxonomy:
      | Slug       | Name            | SpecRole   | Scope  |
      | PERS-001   | Personality     | EXTRACT    | SYSTEM |
      | COMP-001   | Composition     | SYNTHESISE | SYSTEM |
      | TUT-001    | Tutor Identity  | IDENTITY   | DOMAIN |
      | WNF-001    | Content         | CONTENT    | DOMAIN |
      | PIPELINE-1 | Pipeline Config | ORCHESTRATE| SYSTEM |

  # =============================================================================
  # ADD SPEC TO PLAYBOOK
  # =============================================================================

  @spec-toggle
  Scenario: Add domain spec to draft playbook
    Given a draft playbook "My Playbook" exists
    When I PATCH /api/playbooks/{id} with:
      """
      {
        "toggleSpec": {
          "specId": "tut-001-id",
          "enabled": true
        }
      }
      """
    Then a PlaybookItem should be created with isEnabled=true

  @spec-toggle
  Scenario: Toggle existing spec off
    Given a playbook with spec "TUT-001" enabled
    When I PATCH with toggleSpec enabled=false
    Then the PlaybookItem.isEnabled should be false
    And the item should NOT be deleted

  @spec-toggle
  Scenario: Cannot add domain spec to published playbook
    Given a published playbook exists
    When I PATCH with a domain toggleSpec
    Then I should receive error "Cannot modify a published playbook"

  # =============================================================================
  # SYSTEM SPEC TOGGLES
  # =============================================================================

  @system-specs
  Scenario: Toggle system spec on published playbook
    Given a published playbook exists
    When I PATCH with toggleSpec for a SYSTEM scope spec
    Then the toggle should succeed
    And config.systemSpecToggles should be updated

  @system-specs
  Scenario: System spec toggles stored in config
    Given a playbook with system spec toggles
    Then playbook.config.systemSpecToggles should contain:
      """
      {
        "system-spec-id": {
          "isEnabled": true,
          "configOverride": null
        }
      }
      """

  @system-specs
  Scenario: GET playbook returns systemSpecs array
    Given a playbook with system spec toggles in config
    When I GET /api/playbooks/{id}
    Then the response should include systemSpecs array with specId, isEnabled, configOverride

  # =============================================================================
  # BULK OPERATIONS
  # =============================================================================

  @bulk
  Scenario: Update all items at once
    Given a draft playbook
    When I PATCH with items array containing SPEC and PROMPT_TEMPLATE items
    Then all existing PlaybookItems should be deleted
    And new items should be created with correct sortOrder

  # =============================================================================
  # PUBLISHED PLAYBOOK RESTRICTIONS
  # =============================================================================

  @restrictions
  Scenario: Cannot update name on published playbook
    Given a published playbook
    When I PATCH with name "New Name"
    Then I should receive error "Cannot modify a published playbook"

  @restrictions
  Scenario: CAN update sortOrder on published playbook
    Given a published playbook with sortOrder=5
    When I PATCH with sortOrder=1
    Then the sortOrder should be updated to 1

  @restrictions
  Scenario: CAN update domainId on published playbook
    Given a published playbook in domain "old-domain"
    When I PATCH with domainId "new-domain-id"
    Then the domainId should be updated

  # =============================================================================
  # PLAYBOOK STATUS TRANSITIONS
  # =============================================================================

  @status
  Scenario: Unpublish playbook (PUBLISHED -> DRAFT)
    Given a published playbook
    When I PATCH with status "DRAFT"
    Then the playbook status should be "DRAFT"

  @status
  Scenario: Archive playbook from any status
    Given a playbook with status "PUBLISHED"
    When I PATCH with status "ARCHIVED"
    Then the playbook status should be "ARCHIVED"

  @status
  Scenario: Invalid status transition
    Given a draft playbook
    When I PATCH with status "PUBLISHED"
    Then I should receive error about invalid status transition

  # =============================================================================
  # SPEC ROLE DISPLAY
  # =============================================================================

  @spec-roles
  Scenario: Playbook builder shows specs grouped by SpecRole
    Given a playbook with specs across multiple roles
    When I view the playbook in the PlaybookBuilder
    Then specs should be categorized by SpecRole:
      | SpecRole    | Display Category |
      | ORCHESTRATE | Flow Control     |
      | EXTRACT     | Measurement      |
      | SYNTHESISE  | Composition      |
      | CONSTRAIN   | Guards           |
      | IDENTITY    | Agent Personas   |
      | CONTENT     | Curriculum       |
      | VOICE       | Voice Guidance   |
    And each spec should show a SpecRoleBadge

  # =============================================================================
  # ERROR HANDLING
  # =============================================================================

  @errors
  Scenario: toggleSpec with non-existent spec
    When I PATCH with toggleSpec for non-existent specId
    Then I should receive 404 with error "Spec not found"

  @errors
  Scenario: DELETE published playbook
    Given a published playbook
    When I DELETE /api/playbooks/{id}
    Then I should receive error "Cannot delete a published playbook. Archive it instead."

  @errors
  Scenario: DELETE draft playbook cascades
    Given a draft playbook with 5 PlaybookItems
    When I DELETE /api/playbooks/{id}
    Then all PlaybookItems should be deleted
    And the playbook should be deleted
