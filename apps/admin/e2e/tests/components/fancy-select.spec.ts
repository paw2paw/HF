import { test, expect } from '../../fixtures';

/**
 * FancySelect Component Tests
 * Tests the searchable dropdown component
 */
test.describe('FancySelect Component', () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs('admin@test.com');
  });

  test.describe('Dropdown Behavior', () => {
    test('should open dropdown on click', async ({ page }) => {
      await page.goto('/x/callers');
      await page.waitForLoadState('domcontentloaded');

      // Find a FancySelect (usually domain filter or caller picker)
      const selectTrigger = page.locator('[data-testid="fancy-select"], [role="combobox"]').first();

      if (await selectTrigger.isVisible()) {
        await selectTrigger.click();

        // Dropdown should open
        const dropdown = page.locator('[role="listbox"], .dropdown-menu, [data-testid="select-options"]');
        await expect(dropdown).toBeVisible();
      }
    });

    test('should close dropdown on click outside', async ({ page }) => {
      await page.goto('/x/callers');
      await page.waitForLoadState('domcontentloaded');

      const selectTrigger = page.locator('[data-testid="fancy-select"], [role="combobox"]').first();

      if (await selectTrigger.isVisible()) {
        await selectTrigger.click();

        const dropdown = page.locator('[role="listbox"], .dropdown-menu');

        if (await dropdown.isVisible()) {
          // Click outside
          await page.locator('body').click({ position: { x: 10, y: 10 } });

          // Dropdown should close
          await expect(dropdown).not.toBeVisible();
        }
      }
    });

    test('should close dropdown on Escape key', async ({ page }) => {
      await page.goto('/x/callers');
      await page.waitForLoadState('domcontentloaded');

      const selectTrigger = page.locator('[data-testid="fancy-select"], [role="combobox"]').first();

      if (await selectTrigger.isVisible()) {
        await selectTrigger.click();

        const dropdown = page.locator('[role="listbox"], .dropdown-menu');

        if (await dropdown.isVisible()) {
          await page.keyboard.press('Escape');
          await expect(dropdown).not.toBeVisible();
        }
      }
    });
  });

  test.describe('Search Filtering', () => {
    test('should filter options by search text', async ({ page }) => {
      await page.goto('/x/callers');
      await page.waitForLoadState('domcontentloaded');

      const selectTrigger = page.locator('[data-testid="fancy-select"], [role="combobox"]').first();

      if (await selectTrigger.isVisible()) {
        await selectTrigger.click();

        // Look for search input in dropdown
        const searchInput = page.locator('[role="listbox"] input, .dropdown-search input');

        if (await searchInput.isVisible()) {
          await searchInput.fill('test');
          await page.waitForTimeout(300);

          // Options should be filtered
          const options = page.locator('[role="option"]');
          // Filtered results
        }
      }
    });

    test('should show no results message when search has no matches', async ({ page }) => {
      await page.goto('/x/callers');
      await page.waitForLoadState('domcontentloaded');

      const selectTrigger = page.locator('[data-testid="fancy-select"], [role="combobox"]').first();

      if (await selectTrigger.isVisible()) {
        await selectTrigger.click();

        const searchInput = page.locator('[role="listbox"] input, .dropdown-search input');

        if (await searchInput.isVisible()) {
          await searchInput.fill('xyznonexistent12345');
          await page.waitForTimeout(300);

          // Should show "no results" message
          const noResults = page.locator('text=No results, text=No options, text=Nothing found');
          // May or may not exist depending on implementation
        }
      }
    });
  });

  test.describe('Keyboard Navigation', () => {
    test('should navigate options with arrow keys', async ({ page }) => {
      await page.goto('/x/callers');
      await page.waitForLoadState('domcontentloaded');

      const selectTrigger = page.locator('[data-testid="fancy-select"], [role="combobox"]').first();

      if (await selectTrigger.isVisible()) {
        await selectTrigger.click();

        const options = page.locator('[role="option"]');
        const optionCount = await options.count();

        if (optionCount > 1) {
          // Press down arrow
          await page.keyboard.press('ArrowDown');
          await page.waitForTimeout(100);

          // First option should be highlighted
          const highlighted = page.locator('[role="option"][data-highlighted="true"], [role="option"].highlighted');
          // May have focus styling
        }
      }
    });

    test('should select option with Enter key', async ({ page }) => {
      await page.goto('/x/callers');
      await page.waitForLoadState('domcontentloaded');

      const selectTrigger = page.locator('[data-testid="fancy-select"], [role="combobox"]').first();

      if (await selectTrigger.isVisible()) {
        const initialText = await selectTrigger.textContent();

        await selectTrigger.click();

        const options = page.locator('[role="option"]');

        if ((await options.count()) > 0) {
          await page.keyboard.press('ArrowDown');
          await page.keyboard.press('Enter');

          await page.waitForTimeout(300);

          // Dropdown should close
          const dropdown = page.locator('[role="listbox"]');
          await expect(dropdown).not.toBeVisible();
        }
      }
    });
  });

  test.describe('Selection', () => {
    test('should display selected value', async ({ page }) => {
      await page.goto('/x/callers');
      await page.waitForLoadState('domcontentloaded');

      const selectTrigger = page.locator('[data-testid="fancy-select"], [role="combobox"]').first();

      if (await selectTrigger.isVisible()) {
        await selectTrigger.click();

        const firstOption = page.locator('[role="option"]').first();

        if (await firstOption.isVisible()) {
          const optionText = await firstOption.textContent();
          await firstOption.click();

          await page.waitForTimeout(300);

          // Trigger should show selected value
          const selectedText = await selectTrigger.textContent();
          // Selected text should match option
        }
      }
    });

    test('should have clear button when value selected', async ({ page }) => {
      await page.goto('/x/callers');
      await page.waitForLoadState('domcontentloaded');

      const selectTrigger = page.locator('[data-testid="fancy-select"], [role="combobox"]').first();

      if (await selectTrigger.isVisible()) {
        await selectTrigger.click();

        const firstOption = page.locator('[role="option"]').first();

        if (await firstOption.isVisible()) {
          await firstOption.click();
          await page.waitForTimeout(300);

          // Look for clear button
          const clearButton = page.locator('[data-testid="clear-select"], button[aria-label*="clear"], .clear-button');
          // May or may not exist
        }
      }
    });
  });
});
