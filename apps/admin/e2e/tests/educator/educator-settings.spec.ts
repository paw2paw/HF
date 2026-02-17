import { test, expect } from '../../fixtures';

/**
 * Educator Settings E2E Tests
 *
 * Tests the terminology settings page accessible to institution admins
 * at /x/educator/settings.
 */
test.describe('Educator Settings — Terminology', () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs('admin@test.com');
  });

  test('should load settings page with terminology section', async ({ page }) => {
    await page.goto('/x/educator/settings');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Terminology Profile')).toBeVisible();
    await expect(page.getByText(/choose how your/i)).toBeVisible();
  });

  test('should display all four preset buttons', async ({ page }) => {
    await page.goto('/x/educator/settings');
    await page.waitForLoadState('networkidle');

    for (const preset of ['School', 'Corporate', 'Coaching', 'Healthcare']) {
      await expect(
        page.locator('button').filter({ hasText: preset }).first()
      ).toBeVisible();
    }
  });

  test('should switch presets and update preview', async ({ page }) => {
    await page.goto('/x/educator/settings');
    await page.waitForLoadState('networkidle');

    await page.locator('button').filter({ hasText: 'Corporate' }).first().click();
    await expect(page.getByText('Organization').first()).toBeVisible();
    await expect(page.getByText('Employee').first()).toBeVisible();
  });

  test('should save and show success message', async ({ page }) => {
    await page.goto('/x/educator/settings');
    await page.waitForLoadState('networkidle');

    await page.locator('button').filter({ hasText: 'School' }).first().click();
    await page.getByText('Save Changes').click();
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 5000 });
  });

  test('should toggle customize fields and show custom badge', async ({ page }) => {
    await page.goto('/x/educator/settings');
    await page.waitForLoadState('networkidle');

    await page.locator('button').filter({ hasText: 'School' }).first().click();
    await page.getByText('Customize individual terms').click();
    await expect(page.getByText('Hide customization')).toBeVisible();

    const learnerInput = page.locator('input[placeholder="Student"]');
    await learnerInput.fill('Pupil');
    await expect(page.getByText('Pupil').first()).toBeVisible();
    await expect(page.getByText('custom').first()).toBeVisible();
  });

  test('should persist after save and reload', async ({ page }) => {
    await page.goto('/x/educator/settings');
    await page.waitForLoadState('networkidle');

    await page.locator('button').filter({ hasText: 'Coaching' }).first().click();
    await page.getByText('Save Changes').click();
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 5000 });

    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Practice').first()).toBeVisible();
    await expect(page.getByText('Client').first()).toBeVisible();
  });

  test.afterAll(async ({ browser }) => {
    // Reset terminology back to school defaults
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    await page.locator('#email').fill('admin@test.com');
    await page.locator('#password').fill(process.env.SEED_ADMIN_PASSWORD || 'admin123');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/x/, { timeout: 10000 });

    await page.goto('/x/educator/settings');
    await page.waitForLoadState('networkidle');
    await page.locator('button').filter({ hasText: 'School' }).first().click();
    await page.getByText('Save Changes').click();
    await page.waitForTimeout(1000);
    await context.close();
  });
});
