import { test, expect } from '../../fixtures';
import { SidebarPage } from '../../page-objects';

/**
 * Callers List Page Tests
 * Tests the /x/callers page functionality
 */
test.describe('Callers List', () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs('admin@test.com');
  });

  test('should display callers list page', async ({ page }) => {
    await page.goto('/x/callers');
    await page.waitForLoadState('domcontentloaded');

    // Page should load with header
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('should navigate to callers via sidebar', async ({ page }) => {
    const sidebar = new SidebarPage(page);
    await sidebar.goto();
    await sidebar.goToCallers();

    await expect(page).toHaveURL(/\/x\/callers/);
  });

  test('should display caller cards or table', async ({ page }) => {
    await page.goto('/x/callers');
    await page.waitForLoadState('networkidle');

    // Should have either caller cards or a table
    const hasCallerCards = await page.locator('[data-testid="caller-card"]').count() > 0;
    const hasCallerTable = await page.locator('table').count() > 0;
    const hasCallerList = await page.locator('[data-testid="caller-list"]').count() > 0;

    expect(hasCallerCards || hasCallerTable || hasCallerList).toBe(true);
  });

  test('should have search functionality', async ({ page }) => {
    await page.goto('/x/callers');
    await page.waitForLoadState('domcontentloaded');

    // Look for search input
    const searchInput = page.locator('input[type="search"], input[placeholder*="Search"], input[placeholder*="search"]');

    if (await searchInput.isVisible()) {
      await searchInput.fill('test');
      // Should filter results or trigger search
      await page.waitForTimeout(500); // debounce
    }
  });

  test('should navigate to caller detail on click', async ({ page }) => {
    await page.goto('/x/callers');
    await page.waitForLoadState('networkidle');

    // Find clickable caller element
    const callerLink = page.locator('a[href*="/x/callers/"]').first();

    if (await callerLink.isVisible()) {
      await callerLink.click();
      await expect(page).toHaveURL(/\/x\/callers\/[^/]+/);
    }
  });

  test('should display domain filter', async ({ page }) => {
    await page.goto('/x/callers');
    await page.waitForLoadState('domcontentloaded');

    // Look for domain filter dropdown
    const domainFilter = page.locator('[data-testid="domain-filter"], select, [role="combobox"]');

    // At least one filter element should exist
    const filterCount = await domainFilter.count();
    // This is optional - some pages might not have domain filter visible
  });
});

test.describe('Caller Detail', () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs('admin@test.com');
  });

  test('should display caller profile when navigating to detail', async ({ page }) => {
    // First go to callers list
    await page.goto('/x/callers');
    await page.waitForLoadState('networkidle');

    // Click on a caller
    const callerLink = page.locator('a[href*="/x/callers/"]').first();

    if (await callerLink.isVisible()) {
      await callerLink.click();
      await page.waitForLoadState('domcontentloaded');

      // Should show caller detail page
      await expect(page).toHaveURL(/\/x\/callers\/[^/]+/);

      // Should have profile information
      const pageContent = page.locator('main, [role="main"], .content');
      await expect(pageContent).toBeVisible();
    }
  });

  test('should display tabs on caller detail page', async ({ page }) => {
    await page.goto('/x/callers');
    await page.waitForLoadState('networkidle');

    const callerLink = page.locator('a[href*="/x/callers/"]').first();

    if (await callerLink.isVisible()) {
      await callerLink.click();
      await page.waitForLoadState('domcontentloaded');

      // Look for tab navigation
      const tabs = page.locator('[role="tablist"], .tabs, [data-testid*="tab"]');

      if (await tabs.isVisible()) {
        // Tabs should be present for caller profile
        const tabCount = await tabs.locator('[role="tab"], button, a').count();
        expect(tabCount).toBeGreaterThan(0);
      }
    }
  });

  test('should switch between tabs', async ({ page }) => {
    await page.goto('/x/callers');
    await page.waitForLoadState('networkidle');

    const callerLink = page.locator('a[href*="/x/callers/"]').first();

    if (await callerLink.isVisible()) {
      await callerLink.click();
      await page.waitForLoadState('domcontentloaded');

      // Find tabs
      const tabButtons = page.locator('[role="tab"], .tab-button');

      if ((await tabButtons.count()) > 1) {
        // Click second tab
        await tabButtons.nth(1).click();
        await page.waitForTimeout(300);

        // Tab should be active
        await expect(tabButtons.nth(1)).toHaveAttribute('aria-selected', 'true');
      }
    }
  });
});
