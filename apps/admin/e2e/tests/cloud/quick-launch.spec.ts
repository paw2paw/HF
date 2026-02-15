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

    await expect(page.getByText('Quick Launch')).toBeVisible();
    await expect(ql.subjectInput).toBeVisible();
    await expect(ql.buildButton).toBeVisible();
  });

  test('should show generate mode selected by default', async ({ page }) => {
    const ql = new QuickLaunchPage(page);
    await ql.goto();

    // Generate mode is default — summary card should be visible
    await expect(page.getByText("We'll build a course for:")).toBeVisible();
  });

  test('should enable Build button when subject is filled', async ({ page }) => {
    const ql = new QuickLaunchPage(page);
    await ql.goto();

    // Build should be disabled initially (no subject)
    await expect(ql.buildButton).toBeDisabled();

    // Fill subject — persona auto-selects on load
    await ql.fillSubject('E2E Smoke Test');

    // Wait for persona to load (auto-selected from API)
    await page.waitForTimeout(1000);

    // Build should now be enabled
    await expect(ql.buildButton).toBeEnabled();
  });

  test('should complete form and reach review phase', async ({ page }) => {
    test.slow(); // AI analysis — may take longer

    const ql = new QuickLaunchPage(page);
    await ql.goto();

    const subject = `E2E Test ${Date.now()}`;
    await ql.fillSubject(subject);
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

    const subject = `E2E Full Flow ${Date.now()}`;
    await ql.fillSubject(subject);
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
    await expect(ql.viewDomainButton).toBeVisible();
    await expect(ql.viewCallerButton).toBeVisible();
    await expect(ql.launchAnotherButton).toBeVisible();
  });
});
