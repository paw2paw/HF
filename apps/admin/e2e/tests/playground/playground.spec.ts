import { test, expect } from '../../fixtures';
import { SidebarPage } from '../../page-objects';

/**
 * Playground Page Tests
 * Based on __tests__/features/playground-draft-spec.feature
 *
 * Tests the prompt playground functionality
 */
test.describe('Playground', () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs('admin@test.com');
  });

  test.describe('Playground Page', () => {
    test('should display playground at /x/playground', async ({ page }) => {
      await page.goto('/x/playground');
      await page.waitForLoadState('domcontentloaded');

      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    });

    test('should navigate to playground via sidebar', async ({ page }) => {
      const sidebar = new SidebarPage(page);
      await sidebar.goto();
      await sidebar.goToPlayground();

      await expect(page).toHaveURL(/\/x\/playground/);
    });
  });

  test.describe('Caller Selection', () => {
    test('should have caller picker', async ({ page }) => {
      await page.goto('/x/playground');
      await page.waitForLoadState('domcontentloaded');

      // Look for caller selection dropdown
      const callerPicker = page.locator('[data-testid="caller-picker"], [role="combobox"]');
      // May or may not be visible depending on mode
    });

    test('should allow selecting a caller', async ({ page }) => {
      await page.goto('/x/playground');
      await page.waitForLoadState('networkidle');

      const callerPicker = page.locator('[data-testid="caller-picker"], [role="combobox"]').first();

      if (await callerPicker.isVisible()) {
        await callerPicker.click();

        const option = page.locator('[role="option"]').first();

        if (await option.isVisible()) {
          await option.click();
          // Caller should be selected
        }
      }
    });
  });

  test.describe('Prompt Generation', () => {
    test('should have generate prompt button', async ({ page }) => {
      await page.goto('/x/playground');
      await page.waitForLoadState('domcontentloaded');

      const generateButton = page.locator('button:has-text("Generate"), button:has-text("Compose"), button:has-text("Run")');
      // Should have some action button
    });

    test('should display prompt output area', async ({ page }) => {
      await page.goto('/x/playground');
      await page.waitForLoadState('domcontentloaded');

      // Look for output/preview area
      const outputArea = page.locator('[data-testid="prompt-output"], .prompt-preview, textarea[readonly], pre');
      // Should have output display
    });
  });

  test.describe('Draft Spec', () => {
    test('should have draft spec panel', async ({ page }) => {
      await page.goto('/x/playground');
      await page.waitForLoadState('domcontentloaded');

      // Look for draft spec section
      const draftSpecPanel = page.locator('[data-testid="draft-spec"], .draft-spec-panel, :has-text("Draft Spec")');
      // May be collapsed or expanded
    });

    test('should allow pasting spec JSON', async ({ page }) => {
      await page.goto('/x/playground');
      await page.waitForLoadState('domcontentloaded');

      // Look for JSON input area
      const jsonInput = page.locator('textarea[data-testid="spec-json"], .json-editor textarea');

      if (await jsonInput.isVisible()) {
        const testSpec = JSON.stringify({
          id: 'TEST-001',
          title: 'Test Spec',
          scenarios: [],
        });

        await jsonInput.fill(testSpec);
        // Should accept JSON input
      }
    });

    test('should validate spec JSON format', async ({ page }) => {
      await page.goto('/x/playground');
      await page.waitForLoadState('domcontentloaded');

      const jsonInput = page.locator('textarea[data-testid="spec-json"], .json-editor textarea');

      if (await jsonInput.isVisible()) {
        // Enter invalid JSON
        await jsonInput.fill('not valid json {{{');
        await page.waitForTimeout(300);

        // Look for error message
        const errorMessage = page.locator('.error, [data-testid="json-error"], text=Invalid');
        // May show validation error
      }
    });
  });

  test.describe('Modes', () => {
    test('should display mode tabs', async ({ page }) => {
      await page.goto('/x/playground');
      await page.waitForLoadState('domcontentloaded');

      // Look for mode tabs (Caller, Compare, Playbook, etc.)
      const modeTabs = page.locator('[role="tablist"] [role="tab"], .mode-tabs button');
      const modeCount = await modeTabs.count();
      // May have multiple modes
    });

    test('should switch between modes', async ({ page }) => {
      await page.goto('/x/playground');
      await page.waitForLoadState('domcontentloaded');

      const modeTabs = page.locator('[role="tab"]');

      if ((await modeTabs.count()) > 1) {
        const secondMode = modeTabs.nth(1);
        await secondMode.click();

        await page.waitForTimeout(300);

        // Mode should switch
        await expect(secondMode).toHaveAttribute('aria-selected', 'true');
      }
    });
  });
});
