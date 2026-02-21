Feature: Prompt Composition
  As the AI system
  I want to compose personalized prompts for callers
  So that agents can provide tailored conversational experiences

  Background:
    Given a caller "John Doe" exists with ID "caller-123"
    And the caller belongs to domain "english-tutor"
    And the domain has a published playbook with IDENTITY, CONTENT, and EXTRACT specs

  # =============================================================================
  # BASIC COMPOSITION
  # =============================================================================

  @composition @critical
  Scenario: Compose prompt for caller with full profile
    Given the caller has:
      | Data Type            | Count |
      | CallerMemory         | 25    |
      | Recent Calls         | 5     |
      | Goals                | 3     |
      | CallerPlaybook       | 1     |
    And the caller has a CallerPersonalityProfile
    When I POST to /api/callers/caller-123/compose-prompt
    Then the response should be successful
    And the response should include:
      | Field                  | Exists |
      | prompt.id              | yes    |
      | prompt.prompt          | yes    |
      | prompt.llmPrompt       | yes    |
      | metadata.composition   | yes    |
      | metadata.inputContext  | yes    |

  @composition
  Scenario: Compose prompt for new caller with minimal data
    Given the caller has no CallerMemory records
    And the caller has no recent calls
    And the caller has no CallerPersonalityProfile
    When I POST to /api/callers/caller-123/compose-prompt
    Then the response should be successful
    And the prompt should use default behaviour

  @composition
  Scenario: Prompt is stored as ComposedPrompt
    When I compose a prompt for "caller-123"
    Then a ComposedPrompt record should be created
    And it should have status "active"

  @composition
  Scenario: Previous prompts are superseded
    Given the caller has 3 existing active ComposedPrompt records
    When I compose a new prompt
    Then the new prompt should have status "active"
    And the previous 3 prompts should have status "superseded"

  # =============================================================================
  # SECTION DATA LOADER (16 parallel loaders)
  # =============================================================================

  @loader
  Scenario: Composition loads all required data in parallel
    When I compose a prompt for "caller-123"
    Then the SectionDataLoader should load:
      | Data Source      |
      | caller           |
      | memories         |
      | personality      |
      | learnerProfile   |
      | recentCalls      |
      | callCount        |
      | behaviorTargets  |
      | callerTargets    |
      | callerAttributes |
      | goals            |
      | playbooks        |
      | systemSpecs      |

  @loader
  Scenario: Composition uses spec-driven sections
    Given COMP-001 defines sections in its config
    When I compose a prompt
    Then sections from the spec should be processed
    And metadata should report activated and skipped sections

  # =============================================================================
  # BEHAVIOUR TARGET MERGE
  # =============================================================================

  @targets
  Scenario: Composition merges behaviour targets with correct precedence
    Given SYSTEM-level BehaviorTarget for "formality" = 0.5
    And PLAYBOOK-level BehaviorTarget for "formality" = 0.6
    And CALLER-level CallerTarget for "formality" = 0.8
    When I compose a prompt
    Then the effective target for "formality" should be 0.8 (caller wins)

  @targets
  Scenario: Preview with target overrides (not persisted)
    When I POST with targetOverrides:
      """
      {
        "targetOverrides": {
          "formality": 0.9
        }
      }
      """
    Then the composition should use formality=0.9
    And the overrides should NOT be persisted to the database

  # =============================================================================
  # IDENTITY SPEC RESOLUTION
  # =============================================================================

  @identity
  Scenario: Composition resolves identity spec from playbook
    Given the playbook has an IDENTITY spec "TUT-001"
    When I compose a prompt
    Then metadata.inputContext.identitySpec should reference "TUT-001"

  @identity
  Scenario: Identity layer merge (base + overlay)
    Given an IDENTITY spec extends base archetype "TUT-001"
    And the spec has overlay parameters
    When I compose a prompt
    Then the identity should be merged via mergeIdentitySpec()
    And overlay values should override base values

  # =============================================================================
  # AI COMPLETION AND METERING
  # =============================================================================

  @ai
  Scenario: AI completion is metered
    When I compose a prompt
    Then the AI call should be metered via instrumented-ai
    And usage should include promptTokens and completionTokens

  @ai
  Scenario: AI uses PromptTemplateCompiler when template exists
    Given COMP-001 has a promptTemplate defined
    When I compose a prompt
    Then the template should be rendered with caller context
    And the rendered template should be sent to AI

  # =============================================================================
  # TRIGGER TRACKING
  # =============================================================================

  @triggers
  Scenario: Manual trigger
    When I POST with triggerType "manual"
    Then the ComposedPrompt should have triggerType "manual"
    And triggerCallId should be null

  @triggers
  Scenario: Post-call trigger
    Given a call "call-456" just completed
    When the pipeline triggers composition with:
      """
      {
        "triggerType": "post-call",
        "triggerCallId": "call-456"
      }
      """
    Then the ComposedPrompt should have triggerType "post-call"
    And triggerCallId should be "call-456"

  # =============================================================================
  # VOICE PROMPT RENDERING
  # =============================================================================

  @voice
  Scenario: Voice prompt uses renderVoicePrompt
    Given a caller has a composed prompt
    When VAPI requests the assistant configuration via /api/vapi/assistant-request
    Then the prompt should be rendered via renderVoicePrompt()
    And the prompt should include narrative memory framing

  # =============================================================================
  # ERROR HANDLING
  # =============================================================================

  @errors
  Scenario: Handle missing caller
    When I POST to /api/callers/invalid-id/compose-prompt
    Then the response should indicate an error

  @errors
  Scenario: Handle AI service unavailable
    Given the AI service is unavailable
    When I compose a prompt
    Then I should receive an error response
