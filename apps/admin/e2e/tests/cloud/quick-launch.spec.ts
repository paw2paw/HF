import { test, expect } from '../../fixtures';
import { QuickLaunchPage } from '../../page-objects';

/**
 * Quick Launch Cloud E2E Tests
 *
 * Tests the full Quick Launch flow:
 * Fill form → Build It → Committing → Result
 *
 * Requires: AI API keys configured in cloud environment.
 * Uses timestamp suffix for test isolation across runs.
 */
test.describe('Quick Launch — Create Community', () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs('admin@test.com');
  });

  test('should load Quick Launch page with form', async ({ page }) => {
    const ql = new QuickLaunchPage(page);
    await ql.goto();

    await expect(page.getByRole('heading', { name: 'Create Community' })).toBeVisible();
    await expect(ql.briefInput).toBeVisible();
    await expect(ql.buildButton).toBeVisible();
  });

  test('should show summary card with community info', async ({ page }) => {
    const ql = new QuickLaunchPage(page);
    await ql.goto();

    // Summary card should be visible with "What you're building"
    await expect(page.getByText("What you're building", { exact: true })).toBeVisible();
  });

  test('should enable Build button when form is filled', async ({ page }) => {
    const ql = new QuickLaunchPage(page);
    await ql.goto();

    // Build should be disabled initially (no input)
    await expect(ql.buildButton).toBeDisabled();

    // Fill both brief and community name — persona auto-selects on load
    await ql.fillForm('E2E Smoke Test — teaching basic algebra', 'E2E Smoke Community');

    // Wait for persona to load (auto-selected from API)
    await page.waitForTimeout(1000);

    // Build should now be enabled
    await expect(ql.buildButton).toBeEnabled();
  });

  test('should complete full Quick Launch flow end-to-end', async ({ page }) => {
    test.slow(); // Full flow with AI — can take 60-90s

    const ql = new QuickLaunchPage(page);
    await ql.goto();

    const suffix = Date.now();
    await ql.fillForm(
      `E2E Full Flow ${suffix} — teaching creative writing fundamentals`,
      `E2E Full Community ${suffix}`
    );

    // Wait for persona to load
    await page.waitForTimeout(1000);

    // Build It — goes directly to committing phase (no review step)
    await ql.clickBuild();

    // Should transition to committing phase
    await expect(page.locator('.ql-commit-title')).toBeVisible({ timeout: 10_000 });

    // Wait for result phase — scaffold + curriculum generation
    await ql.waitForResult(120_000);

    // Verify result
    await expect(page.getByRole('heading', { name: /Community is Ready|Topic Added/i })).toBeVisible();
    await expect(ql.viewCommunityLink).toBeVisible();
    await expect(ql.tryItLink).toBeVisible();
    await expect(ql.launchAnotherButton).toBeVisible();
  });
});
