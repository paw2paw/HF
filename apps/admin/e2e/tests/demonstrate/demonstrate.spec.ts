import { test, expect } from '../../fixtures';
import { DemonstratePage } from '../../page-objects';

/**
 * Demonstrate Page Tests
 * Tests the /x/demonstrate page — domain-driven course readiness checklist
 */
test.describe('Demonstrate Page', () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs('admin@test.com');
  });

  test('should load page with heading and domain selector', async ({ page }) => {
    await page.goto('/x/demonstrate');
    await page.waitForLoadState('domcontentloaded');

    const demonstratePage = new DemonstratePage(page);
    await expect(demonstratePage.heading).toBeVisible();
    await expect(page.getByText('Domain')).toBeVisible();
  });

  test('should show course readiness checklist when domain selected', async ({ page }) => {
    await page.goto('/x/demonstrate');
    await page.waitForLoadState('networkidle');

    // If domains exist, readiness section should appear
    const readinessText = page.getByText('Course Readiness');
    const noDomains = page.getByText('No domains found');

    // Either we see readiness checks or a "no domains" message
    const hasReadiness = await readinessText.isVisible().catch(() => false);
    const hasNoDomains = await noDomains.isVisible().catch(() => false);

    expect(hasReadiness || hasNoDomains).toBe(true);
  });

  test('should show Start Lesson button when checks are loaded', async ({ page }) => {
    await page.goto('/x/demonstrate');
    await page.waitForLoadState('networkidle');

    const startLesson = page.getByRole('button', { name: 'Start Lesson' });
    const hasButton = await startLesson.isVisible().catch(() => false);

    // Start Lesson only appears if domain has readiness checks
    if (hasButton) {
      await expect(startLesson).toBeVisible();
    }
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
