Feature: Caller Onboarding
  As the AI system
  I want to guide new callers through a first-call onboarding flow
  So that the system learns about them and they feel welcomed

  Background:
    Given a domain "english" exists with onboarding configured
    And the INIT-001 spec defines onboarding flow phases
    And the domain has onboardingIdentitySpecId set

  # =============================================================================
  # ONBOARDING FLOW PHASES (from INIT-001)
  # =============================================================================

  @phases @critical
  Scenario: First call follows onboarding phases
    Given INIT-001 defines phases:
      | phase    | purpose                              |
      | welcome  | Greet and introduce the AI agent     |
      | orient   | Explain what the system does         |
      | discover | Learn about the caller's goals       |
      | sample   | Give a taste of the learning experience |
      | close    | Summarize and set expectations       |
    When a new caller makes their first call
    Then the AI should follow the onboarding phases in order

  @phases
  Scenario: Domain can override onboarding phases
    Given domain "english" has custom onboardingFlowPhases
    When a new caller makes their first call in "english"
    Then the custom phases should be used (not INIT-001 defaults)

  # =============================================================================
  # ONBOARDING SESSION TRACKING
  # =============================================================================

  @tracking
  Scenario: OnboardingSession is created for new caller
    Given a new caller "Alice" enters domain "english" for the first time
    When the first call begins
    Then an OnboardingSession should be created with:
      | field          | value           |
      | callerId       | alice-id        |
      | domainId       | english-id      |
      | isComplete     | false           |
      | currentPhase   | welcome         |

  @tracking
  Scenario: Completed phases are recorded
    Given Alice is in the "discover" phase of onboarding
    When the "discover" phase completes
    Then completedPhases should include:
      """
      [
        { "phase": "welcome", "completedAt": "...", "duration": 120 },
        { "phase": "orient", "completedAt": "...", "duration": 90 },
        { "phase": "discover", "completedAt": "...", "duration": 180 }
      ]
      """

  @tracking
  Scenario: Onboarding marked complete after all phases
    Given Alice has completed all 5 phases
    When the last phase finishes
    Then the OnboardingSession should have:
      | field       | value  |
      | isComplete  | true   |
      | completedAt | now    |

  @tracking
  Scenario: Onboarding can be skipped
    Given an admin marks Alice's onboarding as skipped
    Then the OnboardingSession should have:
      | field      | value |
      | wasSkipped | true  |
      | isComplete | true  |

  # =============================================================================
  # DOMAIN-SPECIFIC ONBOARDING
  # =============================================================================

  @domain
  Scenario: Onboarding uses domain's identity spec
    Given domain "english" has onboardingIdentitySpecId = "TUT-001"
    When the onboarding call begins
    Then the AI should use the TUT-001 identity for the first call

  @domain
  Scenario: Onboarding uses domain's default targets
    Given domain "english" has onboardingDefaultTargets:
      """
      { "formality": 0.3, "encouragement": 0.9 }
      """
    When the first call begins
    Then behaviour should be warm and encouraging (low formality, high encouragement)

  @domain
  Scenario: Onboarding sets domain welcome message
    Given domain "english" has onboardingWelcome = "Welcome to English Literature!"
    When the first call begins
    Then the AI should incorporate the welcome message

  # =============================================================================
  # PER-CALLER PER-DOMAIN (Unique constraint)
  # =============================================================================

  @unique
  Scenario: One onboarding session per caller per domain
    Given Alice has completed onboarding in domain "english"
    When Alice switches to domain "science"
    Then a new OnboardingSession should be created for "science"
    And the "english" OnboardingSession should be unaffected

  @unique
  Scenario: Duplicate onboarding session prevented
    Given Alice has an OnboardingSession in domain "english"
    When the system tries to create another for the same caller/domain
    Then it should upsert (not create a duplicate)

  # =============================================================================
  # ONBOARDING UI
  # =============================================================================

  @ui
  Scenario: Domain settings page shows onboarding config
    When I view domain "english" settings on /x/domains
    Then I should see the OnboardingTab with:
      | field                   | description                    |
      | Identity Spec           | Which persona to use           |
      | Welcome Message         | Custom greeting text           |
      | Flow Phases             | Phase configuration            |
      | Default Targets         | Initial behaviour targets      |

  # =============================================================================
  # ONBOARDING API
  # =============================================================================

  @api
  Scenario: Onboarding status is included in caller data
    When I GET /api/callers/{callerId}
    Then the response should include onboarding status per domain
    And indicate whether onboarding is complete or in progress
