Feature: Agent Tuning
  As an admin or educator
  I want to tune agent behaviour through an intuitive interface
  So that I can adjust how the AI communicates without editing specs directly

  Background:
    Given Parameters exist with isAdjustable = true (BEHAVIOR type)
    And SYSTEM-level BehaviorTargets exist as defaults

  # =============================================================================
  # AGENT TUNER COMPONENT
  # =============================================================================

  @tuner @critical
  Scenario: AgentTuner displays tuning dimensions
    Given the AgentTuner component is rendered
    When it loads parameters and behaviour targets
    Then it should display tuning dimensions as interactive pills
    And each pill should show the current target value
    And adjusting a pill should update the behaviour target

  @tuner
  Scenario: Tuner reads from system and playbook targets
    Given SYSTEM-level BehaviorTarget for "formality" = 0.5
    And PLAYBOOK-level BehaviorTarget for "formality" = 0.7
    When the tuner loads for a specific playbook
    Then the effective value should be 0.7 (playbook overrides system)

  @tuner
  Scenario: Tuner changes produce behaviour targets
    Given the educator adjusts "empathy" from 0.5 to 0.8
    When the tuner state is saved
    Then a BehaviorTarget should be created or updated with:
      | field       | value    |
      | parameterId | empathy  |
      | targetValue | 0.8      |
      | scope       | PLAYBOOK |

  # =============================================================================
  # BOSTON MATRIX (2D Visualization)
  # =============================================================================

  @matrix
  Scenario: Agent tuning supports matrix definitions
    Given AgentTuningSettings defines matrices:
      """
      {
        "matrices": [
          {
            "label": "Teaching Style",
            "xParam": "formality",
            "yParam": "encouragement",
            "xLabel": "Formal <-> Casual",
            "yLabel": "Direct <-> Supportive"
          }
        ]
      }
      """
    When the BostonMatrix renders
    Then the X axis should map to "formality"
    And the Y axis should map to "encouragement"
    And the current position should reflect actual target values

  @matrix
  Scenario: Moving matrix position updates both parameters
    Given the matrix maps formality (X) and encouragement (Y)
    When the user drags the position to (0.8, 0.6)
    Then formality target should be 0.8
    And encouragement target should be 0.6

  # =============================================================================
  # AGENT TUNING SETTINGS (from DB)
  # =============================================================================

  @settings
  Scenario: AgentTuningSettings are stored in SystemSettings
    When I GET /api/agent-tuning/settings
    Then the response should include:
      | field             | type   |
      | matrices          | array  |
      | derivedConfidence | number |

  @settings
  Scenario: Update agent tuning settings
    When I PATCH /api/agent-tuning/settings with new matrix definitions
    Then the SystemSettings should be updated
    And the new matrices should take effect immediately

  # =============================================================================
  # AGENT TUNER INTERPRET (AI-assisted)
  # =============================================================================

  @interpret
  Scenario: AI interprets natural language tuning intent
    When I POST /api/agent-tuner/interpret with:
      """
      { "intent": "Make the tutor more encouraging and less formal" }
      """
    Then the AI should return suggested parameter adjustments:
      | parameter     | adjustment |
      | formality     | decrease   |
      | encouragement | increase   |

  @interpret
  Scenario: Interpret returns derived targets with confidence
    When the AI interprets a tuning intent
    Then each suggestion should include:
      | field       |
      | parameterId |
      | direction   |
      | magnitude   |
      | confidence  |

  # =============================================================================
  # BEHAVIOUR TARGET HIERARCHY
  # =============================================================================

  @hierarchy
  Scenario: Target resolution follows scope precedence
    Given targets exist at multiple scopes:
      | scope    | parameter  | value |
      | SYSTEM   | formality  | 0.5   |
      | PLAYBOOK | formality  | 0.6   |
      | SEGMENT  | formality  | 0.7   |
      | CALLER   | formality  | 0.8   |
    When targets are resolved for a specific caller
    Then the effective value should be 0.8 (CALLER scope wins)

  @hierarchy
  Scenario: Missing scope falls through to next level
    Given targets exist:
      | scope    | parameter  | value |
      | SYSTEM   | formality  | 0.5   |
      | PLAYBOOK | formality  | 0.6   |
    And no SEGMENT or CALLER target exists
    When targets are resolved
    Then the effective value should be 0.6 (PLAYBOOK is highest set)

  # =============================================================================
  # INTEGRATION WITH COURSE SETUP
  # =============================================================================

  @course-setup
  Scenario: Course setup wizard includes agent tuning step
    Given I am on the Course Config step of the course setup wizard
    Then the AgentTuner should be embedded
    And adjustments should be stored in wizard state as behaviorTargets
    And committing the wizard should create PLAYBOOK-level BehaviorTargets
