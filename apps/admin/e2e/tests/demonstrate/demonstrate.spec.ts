import { test, expect } from '../../fixtures';
import { DemonstratePage } from '../../page-objects';

/**
 * Demonstrate Page Tests
 * Tests the /x/demonstrate page — step-based flow with domain, goal, readiness, and launch
 */
test.describe('Demonstrate Page', () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs('admin@test.com');
  });

  test('should load page with heading and step 1 (domain selector)', async ({ page }) => {
    await page.goto('/x/demonstrate');
    await page.waitForLoadState('domcontentloaded');

    const demonstratePage = new DemonstratePage(page);
    await expect(demonstratePage.heading).toBeVisible();
    // Step 1 shows domain selector
    await expect(page.getByText('Domain')).toBeVisible();
  });

  test('should show step flow banner', async ({ page }) => {
    await page.goto('/x/demonstrate');
    await page.waitForLoadState('domcontentloaded');

    // The step flow banner should be visible
    const banner = page.getByRole('navigation', { name: /flow/i });
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Step 1 of 4');
  });

  test('should show Next button on step 1', async ({ page }) => {
    await page.goto('/x/demonstrate');
    await page.waitForLoadState('networkidle');

    const nextBtn = page.getByRole('button', { name: /next/i });
    await expect(nextBtn).toBeVisible();
  });

  test('should show quick action buttons when domain selected', async ({ page }) => {
    await page.goto('/x/demonstrate');
    await page.waitForLoadState('networkidle');

    const viewDomain = page.getByRole('button', { name: 'View Domain' });
    const quickLaunch = page.getByRole('button', { name: 'Quick Launch' });

    const hasDomain = await viewDomain.isVisible().catch(() => false);
    if (hasDomain) {
      await expect(viewDomain).toBeVisible();
      await expect(quickLaunch).toBeVisible();
    }
  });

  test('should accept domainId query parameter', async ({ page }) => {
    // Navigate with a query param — page should not crash
    await page.goto('/x/demonstrate?domainId=nonexistent');
    await page.waitForLoadState('domcontentloaded');

    const demonstratePage = new DemonstratePage(page);
    await expect(demonstratePage.heading).toBeVisible();
  });
});
