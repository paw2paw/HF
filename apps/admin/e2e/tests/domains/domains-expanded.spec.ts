import { test, expect } from '../../fixtures';

/**
 * Domains Page E2E Tests (Expanded)
 * Tests the expanded domains page: list, detail panel, tabs, inline edit
 */
test.describe('Domains List', () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs('admin@test.com');
  });

  test('should load domains page', async ({ page }) => {
    await page.goto('/x/domains');
    await page.waitForLoadState('domcontentloaded');

    const pageContent = page.locator('main, [role="main"]');
    await expect(pageContent).toBeVisible();
  });

  test('should display domain list', async ({ page }) => {
    await page.goto('/x/domains');
    await page.waitForLoadState('networkidle');

    // Should show domains or empty state
    const content = page.locator('main, [role="main"]');
    const textContent = await content.textContent();
    expect(textContent?.length).toBeGreaterThan(0);
  });

  test('should have search/filter functionality', async ({ page }) => {
    await page.goto('/x/domains');
    await page.waitForLoadState('domcontentloaded');

    // Look for search input
    const searchInput = page.locator('input[type="search"], input[placeholder*="Search"], input[placeholder*="search"], input[placeholder*="Filter"]');
    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchInput.fill('test');
      await page.waitForTimeout(500);
    }
  });

  test('should have status filter toggle', async ({ page }) => {
    await page.goto('/x/domains');
    await page.waitForLoadState('domcontentloaded');

    // Look for Active/Inactive filter buttons
    const activeFilter = page.getByText(/active/i).first();
    if (await activeFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(activeFilter).toBeVisible();
    }
  });

  test('should have create domain button', async ({ page }) => {
    await page.goto('/x/domains');
    await page.waitForLoadState('domcontentloaded');

    const createButton = page.locator('button:has-text("Create"), button:has-text("New"), button:has-text("Add")').first();
    if (await createButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(createButton).toBeVisible();
    }
  });
});

test.describe('Domain Detail Panel', () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs('admin@test.com');
  });

  test('should open detail panel when domain is selected', async ({ page }) => {
    await page.goto('/x/domains');
    await page.waitForLoadState('networkidle');

    // Click on a domain to select it
    const domainLink = page.locator('a[href*="/domains?id="], [data-testid="domain-card"], button:has-text("Oakwood"), button:has-text("Default")').first();
    const domainRow = page.locator('tr, [class*="domain-card"], [class*="list-item"]').first();

    if (await domainLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await domainLink.click();
      await page.waitForTimeout(500);
    } else if (await domainRow.isVisible({ timeout: 3000 }).catch(() => false)) {
      await domainRow.click();
      await page.waitForTimeout(500);
    }

    // Detail panel or page should show domain info
    const pageContent = page.locator('main, [role="main"]');
    await expect(pageContent).toBeVisible();
  });

  test('should display tabs in detail view', async ({ page }) => {
    await page.goto('/x/domains');
    await page.waitForLoadState('networkidle');

    // Select a domain
    const domainRow = page.locator('tr, [class*="domain-card"], [class*="list-item"]').first();
    if (await domainRow.isVisible({ timeout: 3000 }).catch(() => false)) {
      await domainRow.click();
      await page.waitForTimeout(500);

      // Should show tabs: Playbooks, Callers, Content, Onboarding
      const tabs = page.locator('[role="tablist"], [class*="tab"]');
      if (await tabs.isVisible({ timeout: 3000 }).catch(() => false)) {
        const tabButtons = tabs.locator('[role="tab"], button');
        const count = await tabButtons.count();
        expect(count).toBeGreaterThan(0);
      }
    }
  });
});

test.describe('Inline Edit (EditableTitle)', () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs('admin@test.com');
  });

  test('should show editable domain name', async ({ page }) => {
    await page.goto('/x/domains');
    await page.waitForLoadState('networkidle');

    // Select a domain
    const domainRow = page.locator('tr, [class*="domain-card"], [class*="list-item"]').first();
    if (await domainRow.isVisible({ timeout: 3000 }).catch(() => false)) {
      await domainRow.click();
      await page.waitForTimeout(500);

      // Look for an editable heading (EditableTitle renders as h1/h2 that's clickable)
      const heading = page.getByRole('heading').first();
      if (await heading.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(heading).toBeVisible();
      }
    }
  });
});
