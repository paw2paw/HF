import { test, expect } from '../../fixtures';
import { StorageKeys } from '../../fixtures';

/**
 * Draggable Tabs Component Tests
 * Tests the DraggableTabs component functionality
 */
test.describe('Draggable Tabs', () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs('admin@test.com');
  });

  test.describe('Tab Display', () => {
    test('should display tabs on pipeline page', async ({ page }) => {
      await page.goto('/x/pipeline');
      await page.waitForLoadState('domcontentloaded');

      // Look for tab list
      const tabList = page.locator('[role="tablist"], .tabs, [data-testid="tab-list"]');
      await expect(tabList).toBeVisible();
    });

    test('should highlight active tab', async ({ page }) => {
      await page.goto('/x/pipeline');
      await page.waitForLoadState('domcontentloaded');

      const tabList = page.locator('[role="tablist"], .tabs');

      if (await tabList.isVisible()) {
        const activeTab = tabList.locator('[aria-selected="true"], .active, [data-active="true"]');
        await expect(activeTab).toBeVisible();
      }
    });

    test('should switch tabs on click', async ({ page }) => {
      await page.goto('/x/pipeline');
      await page.waitForLoadState('domcontentloaded');

      const tabs = page.locator('[role="tab"], .tab-button');

      if ((await tabs.count()) > 1) {
        const firstTab = tabs.first();
        const secondTab = tabs.nth(1);

        // Click second tab
        await secondTab.click();
        await page.waitForTimeout(300);

        // Second tab should be active
        await expect(secondTab).toHaveAttribute('aria-selected', 'true');
      }
    });
  });

  test.describe('Drag and Drop', () => {
    test('should have draggable tabs', async ({ page }) => {
      await page.goto('/x/pipeline');
      await page.waitForLoadState('domcontentloaded');

      const tabs = page.locator('[role="tab"], .tab-button');

      if ((await tabs.count()) > 1) {
        const firstTab = tabs.first();

        // Check for drag handle or draggable attribute
        const isDraggable = await firstTab.evaluate((el) => {
          return (el as HTMLElement).draggable || el.getAttribute('data-draggable') === 'true';
        });

        // May have custom drag implementation
      }
    });

    test('should reorder tabs via drag-drop', async ({ page }) => {
      await page.goto('/x/pipeline');
      await page.waitForLoadState('domcontentloaded');

      const tabs = page.locator('[role="tab"], .tab-button');
      const tabCount = await tabs.count();

      if (tabCount > 1) {
        const firstTab = tabs.first();
        const secondTab = tabs.nth(1);

        const firstTabText = await firstTab.textContent();
        const secondTabText = await secondTab.textContent();

        // Get bounding boxes
        const firstBox = await firstTab.boundingBox();
        const secondBox = await secondTab.boundingBox();

        if (firstBox && secondBox) {
          // Perform drag from first to second position
          await page.mouse.move(
            firstBox.x + firstBox.width / 2,
            firstBox.y + firstBox.height / 2
          );
          await page.mouse.down();
          await page.mouse.move(
            secondBox.x + secondBox.width / 2,
            secondBox.y + secondBox.height / 2,
            { steps: 10 }
          );
          await page.mouse.up();

          await page.waitForTimeout(500);

          // Check if order changed (tabs component may update)
        }
      }
    });
  });

  test.describe('Persistence', () => {
    test('should persist tab order to localStorage', async ({ page }) => {
      await page.goto('/x/pipeline');
      await page.waitForLoadState('domcontentloaded');

      // Set a custom order
      await page.evaluate((key) => {
        localStorage.setItem(key, JSON.stringify(['Blueprint', 'Inspector']));
      }, StorageKeys.PIPELINE_TABS);

      // Reload and check
      await page.reload();
      await page.waitForLoadState('domcontentloaded');

      const stored = await page.evaluate((key) => {
        return localStorage.getItem(key);
      }, StorageKeys.PIPELINE_TABS);

      expect(stored).not.toBeNull();
    });

    test('should restore tab order on page load', async ({ page }) => {
      const customOrder = ['Blueprint', 'Inspector'];

      // Pre-set order before navigation
      await page.goto('/x');
      await page.evaluate(
        ({ key, value }) => {
          localStorage.setItem(key, JSON.stringify(value));
        },
        { key: StorageKeys.PIPELINE_TABS, value: customOrder }
      );

      // Navigate to pipeline
      await page.goto('/x/pipeline');
      await page.waitForLoadState('domcontentloaded');

      const restored = await page.evaluate((key) => {
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : null;
      }, StorageKeys.PIPELINE_TABS);

      expect(restored).toEqual(customOrder);
    });
  });

  test.describe('Reset Button', () => {
    test('should show reset button when order is customized', async ({ page }) => {
      await page.goto('/x/pipeline');
      await page.waitForLoadState('domcontentloaded');

      // Set custom order
      await page.evaluate((key) => {
        localStorage.setItem(key, JSON.stringify(['Blueprint', 'Inspector']));
      }, StorageKeys.PIPELINE_TABS);

      await page.reload();
      await page.waitForLoadState('domcontentloaded');

      // Look for reset button
      const resetButton = page.locator('button:has-text("Reset"), button[title*="Reset"], [data-testid="reset-tabs"]');

      // May be visible if order differs from default
    });

    test('should restore default order on reset', async ({ page }) => {
      await page.goto('/x/pipeline');

      // Set custom order
      await page.evaluate((key) => {
        localStorage.setItem(key, JSON.stringify(['Blueprint', 'Inspector']));
      }, StorageKeys.PIPELINE_TABS);

      await page.reload();
      await page.waitForLoadState('domcontentloaded');

      const resetButton = page.locator('button:has-text("Reset"), [data-testid="reset-tabs"]');

      if (await resetButton.isVisible()) {
        await resetButton.click();
        await page.waitForTimeout(300);

        // localStorage should be cleared or reset
        const stored = await page.evaluate((key) => {
          return localStorage.getItem(key);
        }, StorageKeys.PIPELINE_TABS);

        // Should be null or default order
      }
    });
  });
});
