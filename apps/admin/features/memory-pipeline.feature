Feature: Memory Pipeline
  As the AI system
  I want to extract, consolidate, and decay memories across calls
  So that the AI agent maintains an accurate and relevant picture of each caller

  Background:
    Given a caller "Alice" exists with multiple calls
    And the EXTRACT stage uses specs with outputType LEARN for memory extraction
    And COMP-001 defines memory section configuration

  # =============================================================================
  # MEMORY EXTRACTION (LLM-based)
  # =============================================================================

  @extraction @critical
  Scenario: Extract memories from call transcript
    Given Alice completes a call where she mentions she lives in London and likes gardening
    When the EXTRACT stage runs memory extraction
    Then CallerMemory records should be created:
      | category   | key      | value     | confidence |
      | FACT       | location | London    | 0.9        |
      | PREFERENCE | hobby    | gardening | 0.8        |

  @extraction
  Scenario: Memory categories
    Then CallerMemory records should use these categories:
      | category   | meaning                           |
      | FACT       | Objective facts about the caller   |
      | PREFERENCE | Caller preferences and choices     |
      | EVENT      | Events or experiences mentioned    |
      | CONTEXT    | Contextual/situational information |
      | TOPIC      | Topics discussed or of interest    |
      | RELATION   | Relationships and social context   |

  @extraction
  Scenario: Duplicate memories are deduplicated
    Given Alice already has a memory: key="location" value="Paris" confidence=0.7
    When a new call extracts: key="location" value="London" confidence=0.9
    Then the higher-confidence memory should win
    And only one "location" memory should exist

  @extraction
  Scenario: Memory extraction includes confidence
    When memories are extracted from a transcript
    Then each memory should have confidence between 0.0 and 1.0
    And confidence should reflect how clearly the information was stated

  # =============================================================================
  # RECENCY DECAY
  # =============================================================================

  @decay
  Scenario: Recent memories score higher than old memories
    Given Alice has a memory created 1 day ago (confidence 0.8)
    And Alice has a memory created 120 days ago (confidence 0.8)
    When memory relevance scoring runs with 90-day half-life
    Then the 1-day-old memory should have a higher combined score
    And the 120-day-old memory should have a decayed score

  @decay
  Scenario: Category-specific decay rates
    Given COMP-001 defines category decay rates:
      | category   | rate | meaning                    |
      | CONTEXT    | 0.85 | Decays fastest (situational)|
      | EVENT      | 0.90 | Moderate decay              |
      | TOPIC      | 0.95 | Slow decay                  |
      | FACT       | 1.0  | No decay (permanent)        |
      | PREFERENCE | 1.0  | No decay (stable)           |
      | RELATION   | 1.0  | No decay (stable)           |
    When memory scoring runs
    Then CONTEXT memories should decay fastest
    And FACT, PREFERENCE, RELATION memories should not decay

  # =============================================================================
  # NARRATIVE TEMPLATES
  # =============================================================================

  @narrative @critical
  Scenario: Memories are framed as natural-language sentences
    Given COMP-001 defines 11 default narrative templates
    And Alice has memory: key="location" value="London"
    When the narrative transform runs
    Then the output should be "They live in London" (not "location=London")

  @narrative
  Scenario: Templates come from COMP-001 spec config
    Given COMP-001.memory_section.config.narrativeTemplates contains:
      | key        | template                              |
      | location   | They live in {value}                  |
      | hobby      | They enjoy {value}                    |
      | occupation | They work as a {value}                |
      | family     | Their family includes {value}         |
      | education  | They studied {value}                  |
    When memories matching these keys are formatted
    Then each should use the corresponding template

  @narrative
  Scenario: Generic template for unknown keys
    Given a memory with key "favourite_colour" that has no specific template
    And genericNarrativeTemplate = "Their {key} is {value}"
    When narrative framing runs
    Then the output should be "Their favourite colour is [value]"

  @narrative
  Scenario: Top-3 key_memories in quickstart section
    Given Alice has 10 memories with varying scores
    When the quickstart section is composed
    Then the top 3 memories by combined score should appear as key_memories

  # =============================================================================
  # CONTEXT-AWARE RELEVANCE
  # =============================================================================

  @relevance
  Scenario: Alpha blending combines confidence and relevance
    Given relevanceAlpha = 0.6 in COMP-001 config
    And a memory has confidence=0.9, relevance=0.2
    When the combined score is computed
    Then score = (0.6 * 0.9) + (0.4 * 0.2) = 0.62

  @relevance
  Scenario: Category weights add relevance boost
    Given categoryRelevanceWeights in COMP-001:
      | category | weight |
      | CONTEXT  | 0.15   |
      | TOPIC    | 0.10   |
      | FACT     | 0.0    |
    And a CONTEXT memory matches current content keywords
    When relevance scoring runs
    Then the CONTEXT memory gets an additional 0.15 boost
    And the total score is capped at 1.0

  # =============================================================================
  # MEMORY IN VOICE PROMPTS
  # =============================================================================

  @voice
  Scenario: Voice prompt includes narrative memories
    Given Alice has memories formatted as narrative sentences
    When renderVoicePrompt() is called for Alice
    Then the voice prompt should include the narrative memory block
    And memories should be sorted by combined score (most relevant first)

  # =============================================================================
  # MEMORY API
  # =============================================================================

  @api
  Scenario: Memories are included in caller API responses
    When I GET /api/callers/{callerId}
    Then the response should include memories grouped by category
    And each memory should have key, value, confidence, category, createdAt
