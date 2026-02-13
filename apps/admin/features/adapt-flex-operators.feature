Feature: Adaptation Flex Operators
  As the adaptation pipeline
  I want to evaluate conditions using flexible operators
  So that ADAPT specs can trigger rules based on numeric thresholds, ranges, and sets

  Background:
    Given active ADAPT specs exist with adaptation rules
    And a caller has a learner profile

  # =============================================================================
  # BACKWARD COMPATIBILITY
  # =============================================================================

  Scenario: Missing operator defaults to "eq"
    Given an adaptation rule condition:
      """
      { "profileKey": "learningStyle", "value": "visual" }
      """
    And the caller's learningStyle is "visual"
    When the condition is evaluated
    Then it matches (implicit eq)

  Scenario: Explicit eq operator
    Given an adaptation rule condition:
      """
      { "profileKey": "learningStyle", "operator": "eq", "value": "visual" }
      """
    And the caller's learningStyle is "visual"
    When the condition is evaluated
    Then it matches

  Scenario: eq does not match different value
    Given an adaptation rule condition:
      """
      { "profileKey": "learningStyle", "operator": "eq", "value": "visual" }
      """
    And the caller's learningStyle is "auditory"
    When the condition is evaluated
    Then it does not match

  # =============================================================================
  # NUMERIC COMPARISONS
  # =============================================================================

  Scenario: gt — greater than threshold
    Given an adaptation rule condition:
      """
      { "profileKey": "engagement_score", "operator": "gt", "threshold": 0.7 }
      """
    And the caller's engagement_score is 0.8
    When the condition is evaluated
    Then it matches (0.8 > 0.7)

  Scenario: gt — equal to threshold does not match
    Given an adaptation rule condition:
      """
      { "profileKey": "engagement_score", "operator": "gt", "threshold": 0.7 }
      """
    And the caller's engagement_score is 0.7
    When the condition is evaluated
    Then it does not match (0.7 is not > 0.7)

  Scenario: gte — equal to threshold matches
    Given an adaptation rule condition:
      """
      { "profileKey": "confidence", "operator": "gte", "threshold": 0.6 }
      """
    And the caller's confidence is 0.6
    When the condition is evaluated
    Then it matches (0.6 >= 0.6)

  Scenario: lt — less than threshold
    Given an adaptation rule condition:
      """
      { "profileKey": "error_rate", "operator": "lt", "threshold": 0.3 }
      """
    And the caller's error_rate is 0.2
    When the condition is evaluated
    Then it matches (0.2 < 0.3)

  Scenario: lte — equal to threshold matches
    Given an adaptation rule condition:
      """
      { "profileKey": "score", "operator": "lte", "threshold": 0.5 }
      """
    And the caller's score is 0.5
    When the condition is evaluated
    Then it matches (0.5 <= 0.5)

  # =============================================================================
  # RANGE AND SET OPERATORS
  # =============================================================================

  Scenario: between — value in range (inclusive)
    Given an adaptation rule condition:
      """
      { "profileKey": "mastery", "operator": "between", "range": { "min": 0.3, "max": 0.7 } }
      """
    And the caller's mastery is 0.5
    When the condition is evaluated
    Then it matches (0.3 <= 0.5 <= 0.7)

  Scenario: between — value at boundary matches
    Given an adaptation rule condition:
      """
      { "profileKey": "mastery", "operator": "between", "range": { "min": 0.3, "max": 0.7 } }
      """
    And the caller's mastery is 0.3
    When the condition is evaluated
    Then it matches (inclusive boundary)

  Scenario: between — value outside range does not match
    Given an adaptation rule condition:
      """
      { "profileKey": "mastery", "operator": "between", "range": { "min": 0.3, "max": 0.7 } }
      """
    And the caller's mastery is 0.9
    When the condition is evaluated
    Then it does not match (0.9 > 0.7)

  Scenario: between — missing range field does not match
    Given an adaptation rule condition:
      """
      { "profileKey": "mastery", "operator": "between" }
      """
    When the condition is evaluated
    Then it does not match (range is required for between)

  Scenario: in — value in set
    Given an adaptation rule condition:
      """
      { "profileKey": "learningStyle", "operator": "in", "values": ["visual", "kinesthetic"] }
      """
    And the caller's learningStyle is "kinesthetic"
    When the condition is evaluated
    Then it matches (value in set)

  Scenario: in — value not in set
    Given an adaptation rule condition:
      """
      { "profileKey": "learningStyle", "operator": "in", "values": ["visual", "kinesthetic"] }
      """
    And the caller's learningStyle is "auditory"
    When the condition is evaluated
    Then it does not match

  # =============================================================================
  # DATA SOURCES
  # =============================================================================

  Scenario: Default data source is learnerProfile
    Given an adaptation rule condition:
      """
      { "profileKey": "pacePreference", "value": "fast" }
      """
    When the condition is evaluated
    Then the value is read from the caller's LearnerProfile

  Scenario: parameterValues data source reads from measured scores
    Given an adaptation rule condition:
      """
      { "profileKey": "engagement_score", "operator": "gt", "threshold": 0.7, "dataSource": "parameterValues" }
      """
    And the caller's CallerPersonalityProfile.parameterValues contains engagement_score = 0.85
    When the condition is evaluated
    Then it matches (0.85 > 0.7 from parameterValues)

  # =============================================================================
  # EDGE CASES
  # =============================================================================

  Scenario: Null profile value does not match any operator
    Given the caller's profile value for "missing_key" is null
    When any condition targeting "missing_key" is evaluated
    Then it does not match (regardless of operator)

  Scenario: String value with numeric operator does not match
    Given an adaptation rule condition:
      """
      { "profileKey": "learningStyle", "operator": "gt", "threshold": 0.5 }
      """
    And the caller's learningStyle is "visual" (a string, not a number)
    When the condition is evaluated
    Then it does not match (gt requires numeric value)

  Scenario: Unknown operator does not match
    Given an adaptation rule condition with operator "regex"
    When the condition is evaluated
    Then it does not match (unknown operators fail safely)

  # =============================================================================
  # ADJUSTMENT METHODS
  # =============================================================================

  Scenario: Set adjustment writes absolute value
    Given an adaptation rule action: adjustment="set" value=0.85
    When the action fires
    Then CallerTarget.targetValue = 0.85

  Scenario: Increase adjustment adds delta to current
    Given CallerTarget.targetValue is 0.5
    And an adaptation rule action: adjustment="increase" delta=0.15
    When the action fires
    Then CallerTarget.targetValue = 0.65

  Scenario: Increase is capped at 1.0
    Given CallerTarget.targetValue is 0.95
    And an adaptation rule action: adjustment="increase" delta=0.15
    When the action fires
    Then CallerTarget.targetValue = 1.0

  Scenario: Decrease adjustment subtracts delta from current
    Given CallerTarget.targetValue is 0.5
    And an adaptation rule action: adjustment="decrease" delta=0.15
    When the action fires
    Then CallerTarget.targetValue = 0.35

  Scenario: Decrease is floored at 0.0
    Given CallerTarget.targetValue is 0.05
    And an adaptation rule action: adjustment="decrease" delta=0.15
    When the action fires
    Then CallerTarget.targetValue = 0.0

  Scenario: Confidence comes from spec config
    Given the ADAPT spec has config.defaultAdaptConfidence = 0.6
    When a CallerTarget is written
    Then the confidence value is 0.6 (from spec, not hardcoded)
