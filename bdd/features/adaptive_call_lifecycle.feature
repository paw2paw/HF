Feature: Adaptive call lifecycle with memory-driven prompt evolution

  Background:
    Given a user exists
    And an active agent exists
    And a baseline system prompt template exists

  Scenario: A completed call produces memory that adapts the next call prompt

    Given the system composes an initial prompt for the user
    And a call is started using that prompt

    When the call is active
    And partial transcript chunks are received
    And lightweight sentiment analysis runs

    When the call completes
    And a full transcript is available
    And post-call personality analysis runs

    Then durable user memory is created from the analysis
    And the memory is linked to the completed call

    When the system prepares the next call
    Then the prompt is regenerated using the updated memory
    And the new prompt reflects the user’s inferred personality traits