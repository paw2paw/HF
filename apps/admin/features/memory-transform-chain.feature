Feature: Memory Transform Chain
  As the composition pipeline
  I want to process memories through a chain of transforms
  So that prompts receive deduplicated, relevance-scored, and categorized memories

  Background:
    Given a caller exists with CallerMemory records
    And the COMP-001 spec defines the memories section with transform chain:
      | Step | Transform               |
      | 1    | deduplicateMemories     |
      | 2    | scoreMemoryRelevance    |
      | 3    | groupMemoriesByCategory |

  # =============================================================================
  # TRANSFORM CHAIN EXECUTION
  # =============================================================================

  Scenario: Array transforms execute sequentially
    Given the memories section has transform: ["deduplicateMemories", "scoreMemoryRelevance", "groupMemoriesByCategory"]
    When the CompositionExecutor processes the memories section
    Then deduplicateMemories receives the raw CallerMemory[] data
    And scoreMemoryRelevance receives the output of deduplicateMemories
    And groupMemoriesByCategory receives the output of scoreMemoryRelevance
    And the final output is stored in context.sections.memories

  Scenario: Single string transform still works (backward compatibility)
    Given a section has transform: "deduplicateAndGroupMemories"
    When the CompositionExecutor processes that section
    Then the single transform runs normally

  Scenario: Null transform passes data through
    Given a section has transform: null
    When the CompositionExecutor processes that section
    Then the raw data is stored directly in the output

  Scenario: Unknown transform in chain logs error and stops
    Given a section has transform: ["deduplicateMemories", "nonExistentTransform", "groupMemoriesByCategory"]
    When the CompositionExecutor processes that section
    Then an error is logged for "nonExistentTransform"
    And the chain stops at the unknown transform

  # =============================================================================
  # STEP 1: DEDUPLICATION
  # =============================================================================

  Scenario: Deduplicate memories by normalized key
    Given the caller has CallerMemory records:
      | category | key      | value  | confidence |
      | FACT     | location | London | 0.9        |
      | FACT     | location | Paris  | 0.7        |
      | FACT     | Location | Berlin | 0.5        |
    When deduplicateMemories runs
    Then only 1 memory remains for key "location"
    And it has value "London" (highest confidence 0.9)

  Scenario: Deduplication normalizes keys
    Given the caller has CallerMemory records:
      | category   | key            | value | confidence |
      | PREFERENCE | contact method | email | 0.8        |
      | PREFERENCE | contact_method | phone | 0.6        |
    When deduplicateMemories runs
    Then only 1 memory remains (keys normalize to "preference:contact_method")
    And the higher-confidence entry is kept

  Scenario: Different categories are not deduplicated
    Given the caller has CallerMemory records:
      | category   | key   | value | confidence |
      | FACT       | topic | math  | 0.9        |
      | PREFERENCE | topic | math  | 0.7        |
    When deduplicateMemories runs
    Then 2 memories remain (different categories = different normalized keys)

  # =============================================================================
  # STEP 2: RELEVANCE SCORING (Context-Aware)
  # =============================================================================

  Scenario: Alpha blending controls confidence vs relevance balance
    Given relevanceAlpha = 0.6 in COMP-001 memory_section.config
    And a memory has confidence 0.9 and relevance 0.2
    When the combined score is computed
    Then combinedScore = 0.6 * 0.9 + 0.4 * 0.2 = 0.62

  Scenario: Alpha = 1.0 means pure confidence (legacy behavior)
    Given relevanceAlpha = 1.0
    When the combined score is computed
    Then combinedScore equals the memory's confidence value

  Scenario: Alpha = 0.0 means pure relevance
    Given relevanceAlpha = 0.0
    When the combined score is computed
    Then combinedScore equals the memory's relevance value

  Scenario: Recency decay reduces old memory scores
    Given a memory was created 120 days ago
    And recency decay uses a 90-day half-life
    When the combined score is computed
    Then the recency factor is less than 1.0 (decayed)

  Scenario: Category-specific decay rates apply
    Given category decay rates from COMP-001:
      | category  | decay |
      | CONTEXT   | 0.85  |
      | EVENT     | 0.90  |
      | TOPIC     | 0.95  |
      | FACT      | 1.0   |
      | PREFERENCE| 1.0   |
      | RELATION  | 1.0   |
    Then CONTEXT memories decay fastest
    And FACT, PREFERENCE, RELATION memories never decay

  Scenario: Memories are sorted by combined score descending
    Given 3 memories with different combined scores
    When scoreMemoryRelevance runs
    Then the output array is sorted highest-score first

  # =============================================================================
  # STEP 3: GROUPING
  # =============================================================================

  Scenario: Memories grouped by category
    Given deduplicated memories:
      | category   | key      | value  |
      | FACT       | location | London |
      | FACT       | age      | 30     |
      | PREFERENCE | contact  | email  |
      | TOPIC      | interest | math   |
    When groupMemoriesByCategory runs
    Then byCategory.FACT has 2 entries
    And byCategory.PREFERENCE has 1 entry
    And byCategory.TOPIC has 1 entry
    And totalCount = 4

  Scenario: memoriesPerCategory limits entries per group
    Given memoriesPerCategory = 2 in section config
    And 5 FACT memories exist
    When groupMemoriesByCategory runs
    Then byCategory.FACT has exactly 2 entries
    But totalCount reflects all 5

  Scenario: All categories are dynamic (not hardcoded)
    Given memories with categories: FACT, EVENT, CONTEXT, CUSTOM_CATEGORY
    When groupMemoriesByCategory runs
    Then byCategory has keys for all 4 categories

  # =============================================================================
  # NARRATIVE FRAMING
  # =============================================================================

  Scenario: Narrative templates from COMP-001 spec
    Given COMP-001 memory_section.config.narrativeTemplates contains:
      | key      | template             |
      | location | They live in {value} |
      | hobby    | They enjoy {value}   |
    And the caller has memories: location="London", hobby="gardening"
    When narrative framing runs in the instructions transform
    Then the output contains "They live in London"
    And the output contains "They enjoy gardening"

  Scenario: Top-3 key_memories appear in quickstart section
    Given the caller has 10 memories with varying combined scores
    When prompt composition includes the quickstart section
    Then the top 3 memories by combined score appear as key_memories
    And they are formatted as natural-language sentences

  Scenario: Unknown keys use generic template
    Given genericNarrativeTemplate = "Their {key} is {value}"
    And the caller has a memory: key="pet_name" value="Rex"
    When narrative framing runs
    Then the output contains "Their pet name is Rex"

  Scenario: Empty memories produce empty narrative
    Given the caller has no CallerMemory records
    When narrative framing runs
    Then the output is an empty string
