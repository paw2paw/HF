Feature: Prompt Composition
  As the AI system
  I want to compose personalized prompts for callers
  So that agents can provide tailored conversational experiences

  Background:
    Given a caller "John Doe" exists with ID "caller-123"
    And the caller belongs to domain "companion"

  # =============================================================================
  # BASIC COMPOSITION
  # =============================================================================

  Scenario: Compose prompt for caller with full profile
    Given the caller has:
      | Data Type     | Count |
      | Memories      | 25    |
      | Recent Calls  | 5     |
      | Goals         | 3     |
    And the caller has personality data
    When I POST to /api/callers/caller-123/compose-prompt
    Then the response should be successful
    And the response should include:
      | Field                           | Exists |
      | prompt.id                       | yes    |
      | prompt.prompt                   | yes    |
      | prompt.llmPrompt                | yes    |
      | metadata.composition            | yes    |
      | metadata.inputContext           | yes    |

  Scenario: Compose prompt for new caller with minimal data
    Given the caller has no memories
    And the caller has no recent calls
    And the caller has no personality data
    When I POST to /api/callers/caller-123/compose-prompt
    Then the response should be successful
    And the prompt should use default behavior

  Scenario: Prompt is stored in database
    When I compose a prompt for "caller-123"
    Then a ComposedPrompt record should be created
    And it should have status "active"

  Scenario: Previous prompts are superseded
    Given the caller has 3 existing active prompts
    When I compose a new prompt
    Then the new prompt should have status "active"
    And the previous 3 prompts should have status "superseded"

  # =============================================================================
  # COMPOSITION PIPELINE
  # =============================================================================

  Scenario: Composition loads all required data
    When I compose a prompt for "caller-123"
    Then the composition should load:
      | Data Source       |
      | caller            |
      | memories          |
      | personality       |
      | learnerProfile    |
      | recentCalls       |
      | callCount         |
      | behaviorTargets   |
      | callerTargets     |
      | callerAttributes  |
      | goals             |
      | playbooks         |
      | systemSpecs       |

  Scenario: Composition uses spec-driven sections
    Given a COMPOSE spec exists with sections defined
    When I compose a prompt
    Then the composition should process sections from the spec
    And metadata should report which sections were activated
    And metadata should report which sections were skipped

  Scenario: Composition merges behavior targets
    Given system-level behavior targets exist
    And playbook-level behavior targets exist
    And caller-level behavior targets exist
    When I compose a prompt
    Then behavior targets should be merged (caller > playbook > system)
    And metadata.behaviorTargetsCount should reflect merged count

  Scenario: Composition resolves identity spec
    Given a playbook with an IDENTITY spec "Agent Persona"
    When I compose a prompt
    Then metadata.inputContext.identitySpec should be "Agent Persona"

  Scenario: Composition resolves content spec
    Given a playbook with a CONTENT spec "Product Guide"
    When I compose a prompt
    Then metadata.inputContext.contentSpec should be "Product Guide"

  # =============================================================================
  # TARGET OVERRIDES (PREVIEW)
  # =============================================================================

  Scenario: Preview with target overrides
    Given behavior targets exist:
      | Parameter   | System Value | Playbook Value |
      | formality   | 0.5          | 0.6            |
      | verbosity   | 0.4          | null           |
    When I POST with targetOverrides:
      """
      {
        "targetOverrides": {
          "formality": 0.9,
          "verbosity": 0.2
        }
      }
      """
    Then the composition should use overridden values
    And the overrides should NOT be persisted

  Scenario: Target overrides for Playground tuning
    Given I am testing in Playground
    And I adjust the "formality" slider to 0.8
    When I regenerate the prompt
    Then the prompt should reflect formality=0.8
    And the database targets should remain unchanged

  # =============================================================================
  # AI COMPLETION
  # =============================================================================

  Scenario: Use default AI engine
    When I compose a prompt without specifying engine
    Then the default engine should be used
    And metadata.engine should be populated

  Scenario: Use specified AI engine
    When I POST with engine "claude"
    Then Claude should be used for completion
    And metadata.engine should be "claude"

  Scenario: AI completion is metered
    When I compose a prompt
    Then the AI call should be metered
    And usage should include:
      | Field            |
      | promptTokens     |
      | completionTokens |

  Scenario: AI uses prompt template when available
    Given the COMPOSE spec has a promptTemplate
    When I compose a prompt
    Then the template should be rendered with caller context
    And the rendered template should be sent to AI

  Scenario: AI uses default prompts when no template
    Given the COMPOSE spec has no promptTemplate
    When I compose a prompt
    Then default system/user prompts should be used

  # =============================================================================
  # PROMPT HISTORY
  # =============================================================================

  Scenario: Get all prompts for caller
    Given the caller has 10 composed prompts
    When I GET /api/callers/caller-123/compose-prompt
    Then I should receive all 10 prompts
    And they should be ordered by composedAt descending

  Scenario: Filter prompts by status
    Given the caller has:
      | Status     | Count |
      | active     | 1     |
      | superseded | 9     |
    When I GET /api/callers/caller-123/compose-prompt?status=active
    Then I should receive 1 prompt
    And it should have status "active"

  Scenario: Limit prompt history
    Given the caller has 50 composed prompts
    When I GET /api/callers/caller-123/compose-prompt?limit=5
    Then I should receive exactly 5 prompts

  Scenario: Default limit is 20
    Given the caller has 50 composed prompts
    When I GET /api/callers/caller-123/compose-prompt
    Then I should receive 20 prompts

  # =============================================================================
  # ERROR HANDLING
  # =============================================================================

  Scenario: Handle missing caller
    When I POST to /api/callers/invalid-id/compose-prompt
    Then the response should indicate an error
    And composition should fail gracefully

  Scenario: Handle AI service unavailable
    Given the AI service is unavailable
    When I compose a prompt
    Then I should receive an error response
    And the error should indicate "AI service unavailable"

  Scenario: Handle database error
    Given the database is unavailable
    When I compose a prompt
    Then I should receive an error response
    And the error should be logged

  # =============================================================================
  # TRIGGER TRACKING
  # =============================================================================

  Scenario: Manual trigger
    When I POST with triggerType "manual"
    Then the prompt should have triggerType "manual"
    And triggerCallId should be null

  Scenario: Post-call trigger
    Given a call "call-456" just completed
    When I POST with:
      """
      {
        "triggerType": "post-call",
        "triggerCallId": "call-456"
      }
      """
    Then the prompt should have triggerType "post-call"
    And triggerCallId should be "call-456"
    And the prompt should include triggerCall relationship
