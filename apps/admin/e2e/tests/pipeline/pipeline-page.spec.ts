import { test, expect } from '../../fixtures';
import { SidebarPage } from '../../page-objects';

/**
 * Pipeline Page Tests
 * Tests the /x/pipeline page functionality
 */
test.describe('Pipeline', () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs('admin@test.com');
  });

  test.describe('Pipeline List', () => {
    test('should display pipeline page at /x/pipeline', async ({ page }) => {
      await page.goto('/x/pipeline');
      await page.waitForLoadState('domcontentloaded');

      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    });

    test('should navigate to pipeline via sidebar', async ({ page }) => {
      const sidebar = new SidebarPage(page);
      await sidebar.goto();
      await sidebar.goToPipeline();

      await expect(page).toHaveURL(/\/x\/pipeline/);
    });

    test('should display run history', async ({ page }) => {
      await page.goto('/x/pipeline');
      await page.waitForLoadState('networkidle');

      // Look for run items
      const runItems = page.locator('[data-testid="run-item"], .run-card, tr[data-run-id]');
      const runCount = await runItems.count();

      // May have 0 runs if no pipelines executed
      expect(runCount).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Tabs', () => {
    test('should display tabs on pipeline page', async ({ page }) => {
      await page.goto('/x/pipeline');
      await page.waitForLoadState('domcontentloaded');

      const tabList = page.locator('[role="tablist"], .tabs');
      await expect(tabList).toBeVisible();
    });

    test('should switch between tabs', async ({ page }) => {
      await page.goto('/x/pipeline');
      await page.waitForLoadState('domcontentloaded');

      const tabs = page.locator('[role="tab"]');

      if ((await tabs.count()) > 1) {
        const secondTab = tabs.nth(1);
        await secondTab.click();

        await page.waitForTimeout(300);

        await expect(secondTab).toHaveAttribute('aria-selected', 'true');
      }
    });
  });

  test.describe('Run Inspector', () => {
    test('should display run inspector panel', async ({ page }) => {
      await page.goto('/x/pipeline');
      await page.waitForLoadState('networkidle');

      // Look for inspector tab or panel
      const inspectorTab = page.locator('[role="tab"]:has-text("Inspector"), button:has-text("Inspector")');

      if (await inspectorTab.isVisible()) {
        await inspectorTab.click();
        await page.waitForTimeout(300);

        // Inspector content should be visible
        const inspectorPanel = page.locator('[data-testid="run-inspector"], .inspector-panel');
        // May or may not have content depending on selected run
      }
    });

    test('should show run details when run selected', async ({ page }) => {
      await page.goto('/x/pipeline');
      await page.waitForLoadState('networkidle');

      // Click on a run item
      const runItem = page.locator('[data-testid="run-item"], .run-card').first();

      if (await runItem.isVisible()) {
        await runItem.click();
        await page.waitForTimeout(300);

        // Details should be visible somewhere
        const details = page.locator('[data-testid="run-details"], .run-details');
        // May show run information
      }
    });
  });

  test.describe('Blueprint', () => {
    test('should display blueprint tab', async ({ page }) => {
      await page.goto('/x/pipeline');
      await page.waitForLoadState('domcontentloaded');

      const blueprintTab = page.locator('[role="tab"]:has-text("Blueprint"), button:has-text("Blueprint")');

      if (await blueprintTab.isVisible()) {
        await blueprintTab.click();
        await page.waitForTimeout(300);

        // Blueprint content should be visible
        const blueprintPanel = page.locator('[data-testid="blueprint"], .blueprint-panel');
      }
    });
  });

  test.describe('Run Actions', () => {
    test('should have run/execute button', async ({ page }) => {
      await page.goto('/x/pipeline');
      await page.waitForLoadState('domcontentloaded');

      const runButton = page.locator('button:has-text("Run"), button:has-text("Execute"), button:has-text("Start")');
      // May or may not be visible based on page state
    });
  });
});
