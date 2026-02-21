Feature: Demonstrate Wizard
  As an admin or educator
  I want to walk through guided demos of platform capabilities
  So that I can understand features and onboard new users

  Background:
    Given I am authenticated
    And demo content exists in lib/demo/registry.ts

  # =============================================================================
  # DEMO LISTING
  # =============================================================================

  @listing
  Scenario: View available demos
    When I navigate to /x/demonstrate
    Then I should see a list of available demos
    And each demo card should show:
      | field       | description               |
      | title       | Demo name                 |
      | description | What the demo covers      |
      | audience    | Who should run this demo  |
      | estimatedTime| How long it takes        |

  @listing
  Scenario: Demos are filtered by audience
    Given demos exist for different audiences (admin, educator, all)
    When I view /x/demonstrate
    Then I should only see demos appropriate for my role

  # =============================================================================
  # DEMO EXECUTION
  # =============================================================================

  @execution
  Scenario: Run a demo
    Given I select a demo "DEMO-TUTOR-001"
    When I navigate to /x/demos/{demoId}
    Then I should see the demo steps
    And each step should have:
      | field       | type                    |
      | title       | Step heading            |
      | description | What to do              |
      | content     | Screenshot or markdown  |
    And I should be able to navigate forward and backward

  @execution
  Scenario: Demo includes screenshots
    Given a demo step has content type "screenshot"
    When the step renders
    Then the ScreenshotViewer should display the image
    And navigation controls should be available

  # =============================================================================
  # DEMONSTRATE WIZARD (StepFlowContext)
  # =============================================================================

  @wizard
  Scenario: Demonstrate page uses StepFlowContext
    When the demonstrate wizard loads
    Then it should use StepFlowContext for step management
    And progress should be tracked via ProgressStepper
    And step state should persist in sessionStorage

  # =============================================================================
  # DEMO NAVIGATION BAR
  # =============================================================================

  @navigation
  Scenario: Demo navigation bar shows progress
    Given I am in the middle of a 5-step demo
    When I view the DemoNavigationBar
    Then I should see step 3 of 5
    And completed steps should be marked
    And I should be able to jump to any completed step

  # =============================================================================
  # DEMO SIDEBAR
  # =============================================================================

  @sidebar
  Scenario: Demo sidebar shows step list
    When a demo is active
    Then the DemoSidebar should list all steps
    And the current step should be highlighted
    And completed steps should show checkmarks
