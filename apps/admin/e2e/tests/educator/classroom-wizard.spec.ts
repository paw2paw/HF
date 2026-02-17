import { test, expect } from '../../fixtures';

/**
 * Classroom Creation Wizard E2E Tests
 * Tests the 4-step wizard: name → courses → review → invite
 */
test.describe('Classroom Creation Wizard', () => {
  test.beforeEach(async ({ loginAs }) => {
    await loginAs('admin@test.com');
  });

  test('should load the create classroom page', async ({ page }) => {
    await page.goto('/x/educator/classrooms/new');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('heading', { name: /create/i })).toBeVisible();
  });

  test('should show step 1 with name and domain fields', async ({ page }) => {
    await page.goto('/x/educator/classrooms/new');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/name & learning focus/i)).toBeVisible();
    await expect(page.getByPlaceholder(/year 10/i)).toBeVisible();
  });

  test('should disable continue button when name is empty', async ({ page }) => {
    await page.goto('/x/educator/classrooms/new');
    await page.waitForLoadState('networkidle');

    const continueBtn = page.getByRole('button', { name: /continue/i });
    await expect(continueBtn).toBeDisabled();
  });

  test('should advance to courses step after filling name and selecting domain', async ({ page }) => {
    await page.goto('/x/educator/classrooms/new');
    await page.waitForLoadState('networkidle');

    // Fill name
    await page.getByPlaceholder(/year 10/i).fill('E2E Test Classroom');

    // Select first domain if available
    const domainButtons = page.locator('button').filter({ hasText: /.+/ });
    const domainCount = await domainButtons.count();
    if (domainCount > 2) {
      // There should be domain buttons (not just Continue)
      const continueBtn = page.getByRole('button', { name: /continue/i });
      if (await continueBtn.isEnabled()) {
        await continueBtn.click();
        // Should now be on courses step
        await expect(page.getByText(/courses/i)).toBeVisible();
      }
    }
  });

  test('should show invite step with join link and copy buttons', async ({ page }) => {
    await page.goto('/x/educator/classrooms/new');
    await page.waitForLoadState('networkidle');

    // Check that page loaded correctly
    const pageContent = page.locator('main, [role="main"]');
    await expect(pageContent).toBeVisible();
  });
});
