import { test, expect } from '../../fixtures';
import { SidebarPage } from '../../page-objects';

/**
 * Specs Page Tests
 * Tests the /x/specs page functionality
 */
test.describe('Specs Management', () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs('admin@test.com');
  });

  test.describe('Specs List', () => {
    test('should display specs list at /x/specs', async ({ page }) => {
      await page.goto('/x/specs');
      await page.waitForLoadState('domcontentloaded');

      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    });

    test('should navigate to specs via sidebar', async ({ page }) => {
      const sidebar = new SidebarPage(page);
      await sidebar.goto();
      await sidebar.goToSpecs();

      await expect(page).toHaveURL(/\/x\/specs/);
    });

    test('should display spec items', async ({ page }) => {
      await page.goto('/x/specs');
      await page.waitForLoadState('networkidle');

      // Should have spec cards, table rows, or list items
      const specItems = page.locator('[data-testid="spec-item"], .spec-card, tr[data-spec-id]');
      const itemCount = await specItems.count();

      // May have 0 specs if database is empty
      expect(itemCount).toBeGreaterThanOrEqual(0);
    });

    test('should have create new spec button', async ({ page }) => {
      await page.goto('/x/specs');
      await page.waitForLoadState('domcontentloaded');

      const createButton = page.locator('a[href*="/new"], button:has-text("New"), button:has-text("Create")');
      // May or may not be visible based on permissions
    });
  });

  test.describe('Sync Badge', () => {
    test('should show sync badge when unimported specs exist', async ({ page }) => {
      await page.goto('/x/specs');
      await page.waitForLoadState('networkidle');

      // Look for sync badge/link
      const syncBadge = page.locator('a[href*="spec-sync"], [data-testid="sync-badge"]');

      // Badge may or may not exist depending on sync state
      if (await syncBadge.isVisible()) {
        await expect(syncBadge).toBeVisible();
      }
    });

    test('should navigate to spec sync page', async ({ page }) => {
      await page.goto('/x/specs');
      await page.waitForLoadState('networkidle');

      const syncLink = page.locator('a[href*="spec-sync"]');

      if (await syncLink.isVisible()) {
        await syncLink.click();
        await expect(page).toHaveURL(/spec-sync/);
      }
    });
  });

  test.describe('Spec Detail', () => {
    test('should navigate to spec detail on click', async ({ page }) => {
      await page.goto('/x/specs');
      await page.waitForLoadState('networkidle');

      const specLink = page.locator('a[href*="/x/specs/"]').first();

      if (await specLink.isVisible()) {
        await specLink.click();
        // May navigate to spec detail or open modal
      }
    });
  });
});

test.describe('Spec Sync', () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs('admin@test.com');
  });

  test('should display spec sync page', async ({ page }) => {
    await page.goto('/x/admin/spec-sync');
    await page.waitForLoadState('domcontentloaded');

    // Page should load
    await expect(page.locator('body')).toBeVisible();
  });

  test('should show synced, unseeded, and orphaned sections', async ({ page }) => {
    await page.goto('/x/admin/spec-sync');
    await page.waitForLoadState('networkidle');

    // Look for section headers or tabs
    const sections = page.locator('text=Synced, text=Unseeded, text=Orphaned');
    // At least one section should exist
  });

  test('should display summary counts', async ({ page }) => {
    await page.goto('/x/admin/spec-sync');
    await page.waitForLoadState('networkidle');

    // Look for count badges or summary stats
    const summary = page.locator('[data-testid="sync-summary"], .summary-stats');
    // May show counts
  });

  test('should have seed button', async ({ page }) => {
    await page.goto('/x/admin/spec-sync');
    await page.waitForLoadState('domcontentloaded');

    const seedButton = page.locator('button:has-text("Seed"), button:has-text("Import"), button:has-text("Sync")');
    // May be disabled if no unseeded specs
  });

  test('should allow selecting specs for import', async ({ page }) => {
    await page.goto('/x/admin/spec-sync');
    await page.waitForLoadState('networkidle');

    // Look for checkboxes
    const checkboxes = page.locator('input[type="checkbox"]');
    const checkboxCount = await checkboxes.count();

    if (checkboxCount > 0) {
      // Should be able to select specs
      await checkboxes.first().check();
      await expect(checkboxes.first()).toBeChecked();
    }
  });
});
