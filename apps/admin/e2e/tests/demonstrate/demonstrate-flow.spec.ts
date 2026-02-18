import { test, expect } from '../../fixtures';
import { DemonstratePage } from '../../page-objects';

/**
 * Demonstrate Flow Tests
 * Tests the multi-step demonstrate flow: Domain → Goal → Readiness → Launch
 */
test.describe('Demonstrate Flow', () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs('admin@test.com');
  });

  test('step flow banner persists across navigation', async ({ page }) => {
    await page.goto('/x/demonstrate');
    await page.waitForLoadState('networkidle');

    // Step flow banner should be visible
    const banner = page.getByRole('navigation', { name: /flow/i });
    await expect(banner).toBeVisible();

    // Navigate to a different page
    await page.goto('/x/domains');
    await page.waitForLoadState('domcontentloaded');

    // Banner should still be visible with "Back to Demonstrate" button
    await expect(banner).toBeVisible();
    const backBtn = banner.getByRole('button', { name: /back to demonstrate/i });
    await expect(backBtn).toBeVisible();
  });

  test('step flow banner not visible on sim pages', async ({ page }) => {
    // Start the flow first
    await page.goto('/x/demonstrate');
    await page.waitForLoadState('domcontentloaded');

    // Navigate to a sim page
    await page.goto('/x/sim');
    await page.waitForLoadState('domcontentloaded');

    // Banner should NOT be visible on sim pages
    const banner = page.getByRole('navigation', { name: /flow/i });
    await expect(banner).not.toBeVisible();
  });

  test('goal input visible on step 2', async ({ page }) => {
    await page.goto('/x/demonstrate');
    await page.waitForLoadState('networkidle');

    // Check if domains exist and Next is enabled
    const nextBtn = page.getByRole('button', { name: /next/i });
    const isEnabled = await nextBtn.isEnabled().catch(() => false);

    if (isEnabled) {
      // Advance to step 2 (goal)
      await nextBtn.click();

      // Goal textarea should be visible
      const goalInput = page.getByPlaceholder(/what do you want to demonstrate/i);
      await expect(goalInput).toBeVisible();

      // Banner should show step 2
      const banner = page.getByRole('navigation', { name: /flow/i });
      await expect(banner).toContainText('Step 2 of 4');
    }
  });

  test('back button returns to previous step', async ({ page }) => {
    await page.goto('/x/demonstrate');
    await page.waitForLoadState('networkidle');

    const nextBtn = page.getByRole('button', { name: /next/i });
    const isEnabled = await nextBtn.isEnabled().catch(() => false);

    if (isEnabled) {
      await nextBtn.click();
      await page.waitForTimeout(300);

      // Now on step 2, click Back
      const backBtn = page.getByRole('button', { name: /back/i });
      await backBtn.click();

      // Should be back on step 1
      const banner = page.getByRole('navigation', { name: /flow/i });
      await expect(banner).toContainText('Step 1 of 4');
    }
  });
});
