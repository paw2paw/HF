import { test, expect } from '../../fixtures';
import { QuickLaunchPage } from '../../page-objects';

/**
 * Quick Launch Cloud E2E Tests
 *
 * Tests the full Quick Launch flow in generate mode:
 * Fill form → Build → Review → Create → Result
 *
 * Requires: AI API keys configured in cloud environment.
 * Uses timestamp suffix for test isolation across runs.
 */
test.describe('Quick Launch — Generate Mode', () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs('admin@test.com');
  });

  test('should load Quick Launch page with form', async ({ page }) => {
    const ql = new QuickLaunchPage(page);
    await ql.goto();

    await expect(page.getByRole('heading', { name: 'Quick Launch' })).toBeVisible();
    await expect(ql.briefInput).toBeVisible();
    await expect(ql.buildButton).toBeVisible();
  });

  test('should show generate mode selected by default', async ({ page }) => {
    const ql = new QuickLaunchPage(page);
    await ql.goto();

    // Generate mode is default — summary card should be visible
    await expect(page.getByText("We'll build an agent for:")).toBeVisible();
  });

  test('should enable Build button when form is filled', async ({ page }) => {
    const ql = new QuickLaunchPage(page);
    await ql.goto();

    // Build should be disabled initially (no input)
    await expect(ql.buildButton).toBeDisabled();

    // Fill both brief and agent name — persona auto-selects on load
    await ql.fillForm('E2E Smoke Test — teaching basic algebra', 'E2E Smoke Agent');

    // Wait for persona to load (auto-selected from API)
    await page.waitForTimeout(1000);

    // Build should now be enabled
    await expect(ql.buildButton).toBeEnabled();
  });

  test('should complete form and reach review phase', async ({ page }) => {
    test.slow(); // AI analysis — may take longer

    const ql = new QuickLaunchPage(page);
    await ql.goto();

    const suffix = Date.now();
    await ql.fillForm(
      `E2E Test ${suffix} — teaching basic algebra concepts`,
      `E2E Test Agent ${suffix}`
    );
    await ql.selectGenerateMode();

    // Wait for persona to load
    await page.waitForTimeout(1000);

    await ql.clickBuild();

    // Should transition to review phase
    await ql.waitForReviewPhase(90_000);

    // Review panel should show the 3-column layout
    await expect(page.getByText('Your Input')).toBeVisible();
    await expect(page.getByText('AI Understood')).toBeVisible();
    await expect(page.getByText("What We'll Create")).toBeVisible();
  });

  test('should complete full Quick Launch flow end-to-end', async ({ page }) => {
    test.slow(); // Full flow with AI — can take 60-90s

    const ql = new QuickLaunchPage(page);
    await ql.goto();

    const suffix = Date.now();
    await ql.fillForm(
      `E2E Full Flow ${suffix} — teaching creative writing fundamentals`,
      `E2E Full Agent ${suffix}`
    );
    await ql.selectGenerateMode();

    // Wait for persona to load
    await page.waitForTimeout(1000);

    await ql.clickBuild();
    await ql.waitForReviewPhase(90_000);

    // Wait for Create button to be enabled (analysis complete)
    await ql.waitForCreateEnabled(30_000);

    // Commit
    await ql.clickCreate();

    // Wait for result phase — scaffold + curriculum generation
    await ql.waitForResult(120_000);

    // Verify result
    await expect(page.getByText('Ready to test')).toBeVisible();
    await expect(ql.viewAgentButton).toBeVisible();
    await expect(ql.viewCallerButton).toBeVisible();
    await expect(ql.launchAnotherButton).toBeVisible();
  });
});
