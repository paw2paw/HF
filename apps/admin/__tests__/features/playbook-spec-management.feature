Feature: Playbook Spec Management
  As a playbook designer
  I want to add and toggle specs in playbooks
  So that I can configure which behaviors apply to callers

  Background:
    Given I am authenticated as a playbook designer
    And a domain "companion" exists
    And specs exist:
      | Slug              | Name             | Scope  | Type    |
      | spec-engagement   | Engagement Spec  | DOMAIN | MEASURE |
      | spec-sentiment    | Sentiment Spec   | DOMAIN | LEARN   |
      | spec-identity     | Agent Identity   | SYSTEM | DOMAIN  |

  # =============================================================================
  # ADD SPEC TO PLAYBOOK
  # =============================================================================

  Scenario: Add domain spec to draft playbook
    Given a draft playbook "My Playbook" exists
    When I PATCH /api/playbooks/{id} with:
      """
      {
        "toggleSpec": {
          "specId": "spec-engagement-id",
          "enabled": true
        }
      }
      """
    Then the spec should be added to the playbook
    And a PlaybookItem should be created with isEnabled=true

  Scenario: Add spec creates PlaybookItem with correct sortOrder
    Given a draft playbook with 3 existing items (sortOrder 0, 1, 2)
    When I add a new spec
    Then the new PlaybookItem should have sortOrder=3

  Scenario: Toggle existing spec off
    Given a playbook with spec "spec-engagement" enabled
    When I PATCH with toggleSpec enabled=false
    Then the PlaybookItem.isEnabled should be false
    And the item should NOT be deleted

  Scenario: Toggle spec back on
    Given a playbook with spec "spec-engagement" disabled
    When I PATCH with toggleSpec enabled=true
    Then the PlaybookItem.isEnabled should be true

  Scenario: Cannot add domain spec to published playbook
    Given a published playbook exists
    When I PATCH with a domain toggleSpec
    Then I should receive error "Cannot modify a published playbook"

  # =============================================================================
  # SYSTEM SPEC TOGGLES
  # =============================================================================

  Scenario: Toggle system spec on published playbook
    Given a published playbook exists
    When I PATCH with toggleSpec for a SYSTEM spec:
      """
      {
        "toggleSpec": {
          "specId": "system-spec-id",
          "enabled": true
        }
      }
      """
    Then the toggle should succeed
    And config.systemSpecToggles should be updated

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

  Scenario: System spec with config override
    When I save a system spec toggle with configOverride:
      """
      {
        "toggleSpec": {
          "specId": "system-spec-id",
          "enabled": true,
          "configOverride": { "threshold": 0.8 }
        }
      }
      """
    Then the configOverride should be preserved

  Scenario: GET playbook returns systemSpecs array
    Given a playbook with system spec toggles in config
    When I GET /api/playbooks/{id}
    Then the response should include systemSpecs array:
      """
      [
        {
          "specId": "system-spec-1",
          "isEnabled": true,
          "configOverride": null
        }
      ]
      """

  # =============================================================================
  # BULK OPERATIONS
  # =============================================================================

  Scenario: Update all items at once
    Given a draft playbook
    When I PATCH with items array:
      """
      {
        "items": [
          { "itemType": "SPEC", "specId": "spec-1", "isEnabled": true },
          { "itemType": "SPEC", "specId": "spec-2", "isEnabled": false },
          { "itemType": "PROMPT_TEMPLATE", "promptTemplateId": "pt-1" }
        ]
      }
      """
    Then all existing items should be deleted
    And new items should be created with correct sortOrder

  Scenario: Bulk update system specs
    When I PATCH with specs array:
      """
      {
        "specs": [
          { "specId": "sys-1", "isEnabled": true, "configOverride": null },
          { "specId": "sys-2", "isEnabled": false, "configOverride": { "x": 1 } }
        ]
      }
      """
    Then config.systemSpecToggles should be updated with all specs

  # =============================================================================
  # PUBLISHED PLAYBOOK RESTRICTIONS
  # =============================================================================

  Scenario: Cannot update name on published playbook
    Given a published playbook
    When I PATCH with name "New Name"
    Then I should receive error "Cannot modify a published playbook"

  Scenario: Cannot update description on published playbook
    Given a published playbook
    When I PATCH with description "New description"
    Then I should receive error "Cannot modify a published playbook"

  Scenario: Cannot update items on published playbook
    Given a published playbook
    When I PATCH with items array
    Then I should receive error "Cannot modify a published playbook"

  Scenario: Cannot update agentId on published playbook
    Given a published playbook
    When I PATCH with agentId "new-agent"
    Then I should receive error "Cannot modify a published playbook"

  Scenario: CAN update sortOrder on published playbook
    Given a published playbook with sortOrder=5
    When I PATCH with sortOrder=1
    Then the sortOrder should be updated to 1
    And no error should occur

  Scenario: CAN update domainId on published playbook
    Given a published playbook in domain "old-domain"
    When I PATCH with domainId "new-domain-id"
    Then the domainId should be updated
    And no error should occur

  # =============================================================================
  # PLAYBOOK STATUS TRANSITIONS
  # =============================================================================

  Scenario: Unpublish playbook (PUBLISHED → DRAFT)
    Given a published playbook
    When I PATCH with status "DRAFT"
    Then the playbook status should be "DRAFT"
    And I should receive message "Playbook unpublished"

  Scenario: Archive playbook from any status
    Given a playbook with status "PUBLISHED"
    When I PATCH with status "ARCHIVED"
    Then the playbook status should be "ARCHIVED"
    And I should receive message "Playbook archived"

  Scenario: Invalid status transition
    Given a draft playbook
    When I PATCH with status "PUBLISHED"
    Then I should receive error "Invalid status transition: DRAFT → PUBLISHED"

  # =============================================================================
  # ERROR HANDLING
  # =============================================================================

  Scenario: toggleSpec with non-existent spec
    When I PATCH with toggleSpec for non-existent specId
    Then I should receive error "Spec not found"
    And status should be 404

  Scenario: PATCH non-existent playbook
    When I PATCH /api/playbooks/invalid-id
    Then I should receive error "Playbook not found"
    And status should be 404

  Scenario: DELETE published playbook
    Given a published playbook
    When I DELETE /api/playbooks/{id}
    Then I should receive error "Cannot delete a published playbook. Archive it instead."

  Scenario: DELETE draft playbook
    Given a draft playbook with 5 items
    When I DELETE /api/playbooks/{id}
    Then all PlaybookItems should be deleted
    And the playbook should be deleted
    And I should receive message "Playbook deleted"
