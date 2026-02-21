Feature: Adaptive Pipeline
  As the AI system
  I want to process calls through a 6-stage adaptive pipeline
  So that each caller's experience improves over time

  Background:
    Given the pipeline is configured by PIPELINE-001 spec
    And the pipeline stages execute in order:
      | stage     | purpose                                    |
      | EXTRACT   | Measure personality traits and extract data |
      | AGGREGATE | Combine scores into personality profiles    |
      | REWARD    | Compute reward signals from behaviour       |
      | ADAPT     | Adjust targets based on observations        |
      | SUPERVISE | Safety checks and guardrails               |
      | COMPOSE   | Generate next prompt from all data          |

  # =============================================================================
  # PIPELINE EXECUTION (Post-Call)
  # =============================================================================

  @execution @critical
  Scenario: Full pipeline executes after a call
    Given a caller "Alice" completes a call with transcript
    When the pipeline runs for this call
    Then each stage should execute in order: EXTRACT, AGGREGATE, REWARD, ADAPT, SUPERVISE, COMPOSE
    And the final output should be a ComposedPrompt for Alice's next call

  @execution
  Scenario: Pipeline is spec-driven (not hardcoded)
    Given PIPELINE-001 defines which specs run at each stage
    When the pipeline runs
    Then only specs enabled in the playbook (via PlaybookItem or systemSpecToggles) should execute
    And disabled specs should be skipped

  # =============================================================================
  # STAGE 1: EXTRACT
  # =============================================================================

  @extract
  Scenario: EXTRACT stage measures personality traits
    Given EXTRACT specs (e.g., PERS-001) are active
    When the EXTRACT stage runs on a call transcript
    Then CallScore records should be created for each measured parameter
    And each score should have value (0.0-1.0), confidence, and evidence

  @extract
  Scenario: EXTRACT stage extracts memories
    Given EXTRACT specs with outputType LEARN are active
    When the EXTRACT stage runs
    Then CallerMemory records should be created
    And each memory should have category, key, value, and confidence

  @extract
  Scenario: EXTRACT stage measures agent behaviour
    Given EXTRACT specs for BEHAVIOR parameters are active (e.g., MEASURE_AGENT)
    When the EXTRACT stage runs
    Then BehaviorMeasurement records should be created
    And each measurement should have actualValue, confidence, and evidence

  # =============================================================================
  # STAGE 2: AGGREGATE
  # =============================================================================

  @aggregate
  Scenario: AGGREGATE combines scores into personality profile
    Given CallScore records exist for multiple calls
    When the AGGREGATE stage runs
    Then the CallerPersonalityProfile should be updated
    And parameterValues should reflect weighted aggregation across calls

  @aggregate
  Scenario: AGGREGATE uses time-decay weighting
    Given older calls should have less influence
    When the AGGREGATE stage computes scores
    Then more recent calls should have higher weight
    And the decay follows the configured half-life

  # =============================================================================
  # STAGE 3: REWARD
  # =============================================================================

  @reward
  Scenario: REWARD computes reward signal
    Given BehaviorMeasurement records exist for the call
    And BehaviorTarget records exist for the caller
    When the REWARD stage runs
    Then a RewardScore should be computed
    And the reward should compare actual behaviour vs target behaviour

  @reward
  Scenario: REWARD score influences adaptation
    Given a positive reward (agent matched targets)
    When the ADAPT stage runs after REWARD
    Then adaptation should reinforce current targets

  # =============================================================================
  # STAGE 4: ADAPT
  # =============================================================================

  @adapt
  Scenario: ADAPT adjusts caller targets based on rules
    Given an ADAPT spec defines adaptation rules with conditions
    When the ADAPT stage runs and conditions match
    Then CallerTarget records should be created or updated
    And adjustments should respect set/increase/decrease operators
    And values should be bounded [0.0, 1.0]

  @adapt
  Scenario: ADAPT reads from multiple data sources
    Given an ADAPT rule reads from "learnerProfile" data source
    And another rule reads from "parameterValues" data source
    When the ADAPT stage evaluates conditions
    Then each rule should read from its specified data source

  @adapt
  Scenario: ADAPT confidence comes from spec config
    Given the ADAPT spec has defaultAdaptConfidence = 0.6
    When a CallerTarget is written
    Then the confidence should be 0.6

  # =============================================================================
  # STAGE 5: SUPERVISE
  # =============================================================================

  @supervise
  Scenario: SUPERVISE applies safety guardrails
    Given GUARD-001 spec defines safety constraints
    When the SUPERVISE stage runs
    Then the composed prompt should be checked against constraints
    And violations should be logged

  # =============================================================================
  # STAGE 6: COMPOSE
  # =============================================================================

  @compose
  Scenario: COMPOSE generates next prompt
    Given all previous stages have completed
    When the COMPOSE stage runs
    Then a ComposedPrompt should be created
    And it should incorporate:
      | input              | source                      |
      | Identity           | IDENTITY spec (merged)      |
      | Behaviour targets  | CallerTarget + BehaviorTarget|
      | Memories           | CallerMemory (transformed)  |
      | Personality        | CallerPersonalityProfile    |
      | Goals              | Active Goal records         |
      | Content            | CONTENT spec curriculum     |

  @compose
  Scenario: COMPOSE supersedes previous prompts
    Given the caller has an active ComposedPrompt
    When a new prompt is composed
    Then the previous prompt should have status "superseded"
    And the new prompt should have status "active"

  # =============================================================================
  # PIPELINE UI (/x/pipeline)
  # =============================================================================

  @ui
  Scenario: View pipeline configuration
    When I navigate to /x/pipeline
    Then I should see the Blueprint tab showing pipeline stages
    And I should see the Run Inspector tab showing recent pipeline runs

  @ui
  Scenario: Blueprint shows stage configuration
    When I view the Blueprint tab
    Then I should see all 6 stages with their configured specs
    And I should see which specs are active vs disabled

  @ui
  Scenario: Run Inspector shows pipeline execution details
    Given a pipeline run has completed
    When I view the Run Inspector tab
    Then I should see per-stage timing and results
    And I should see any errors that occurred

  # =============================================================================
  # PIPELINE API
  # =============================================================================

  @api
  Scenario: POST /api/pipeline triggers pipeline execution
    When I POST /api/pipeline with callId and callerId
    Then the full pipeline should execute
    And the response should include stage results and composed prompt
