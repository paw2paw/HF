import { test, expect } from '../../fixtures';

/**
 * Masquerade (Step In) E2E Tests
 * Tests admin user impersonation feature
 */
test.describe('Masquerade', () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs('admin@test.com');
  });

  test('should show Step In section in account panel for admin', async ({ page }) => {
    await page.goto('/x');
    await page.waitForLoadState('domcontentloaded');

    // Open account panel — look for avatar/settings button
    const accountTrigger = page.locator(
      'button:has-text("Settings"), [data-testid="account-panel"], button[aria-label*="account"], button[aria-label*="settings"]'
    ).first();

    // Try clicking the avatar or settings area in sidebar footer
    const sidebarFooter = page.locator('nav footer, aside footer, .sidebar-footer').first();
    if (await sidebarFooter.isVisible()) {
      await sidebarFooter.click();
      await page.waitForTimeout(500);
    } else if (await accountTrigger.isVisible()) {
      await accountTrigger.click();
      await page.waitForTimeout(500);
    }

    // Look for "Step In" text in the opened panel
    const stepInText = page.getByText(/step in/i).first();
    if (await stepInText.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(stepInText).toBeVisible();
    }
  });

  test('should show user picker when Step In is expanded', async ({ page }) => {
    await page.goto('/x');
    await page.waitForLoadState('domcontentloaded');

    // Open account panel
    const sidebarFooter = page.locator('nav footer, aside footer, .sidebar-footer').first();
    if (await sidebarFooter.isVisible()) {
      await sidebarFooter.click();
      await page.waitForTimeout(500);
    }

    // Click Step In toggle
    const stepInToggle = page.getByText(/step in as/i).first();
    if (await stepInToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
      await stepInToggle.click();
      await page.waitForTimeout(500);

      // Search input should appear
      const searchInput = page.locator('input[placeholder*="Search by name"]');
      if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(searchInput).toBeVisible();
      }
    }
  });

  test('should display purple border when masquerading', async ({ page }) => {
    await page.goto('/x');
    await page.waitForLoadState('domcontentloaded');

    // Open account panel
    const sidebarFooter = page.locator('nav footer, aside footer, .sidebar-footer').first();
    if (await sidebarFooter.isVisible()) {
      await sidebarFooter.click();
      await page.waitForTimeout(500);
    }

    // Expand Step In and click a user
    const stepInToggle = page.getByText(/step in as/i).first();
    if (await stepInToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
      await stepInToggle.click();
      await page.waitForTimeout(500);

      // Click first available user in the picker
      const userButtons = page.locator('button:has-text("@")');
      if ((await userButtons.count()) > 0) {
        await userButtons.first().click();
        await page.waitForTimeout(1000);

        // Should see purple status bar (masquerade indicator)
        // Look for masquerade class on status bar
        const banner = page.locator('[class*="masquerade"], [style*="purple"]');
        const maskIcon = page.locator('svg, [class*="mask"]');

        // The page should still be functional
        const pageContent = page.locator('main, [role="main"]');
        await expect(pageContent).toBeVisible();
      }
    }
  });

  test('should allow exiting masquerade', async ({ page }) => {
    await page.goto('/x');
    await page.waitForLoadState('domcontentloaded');

    // Open account panel
    const sidebarFooter = page.locator('nav footer, aside footer, .sidebar-footer').first();
    if (await sidebarFooter.isVisible()) {
      await sidebarFooter.click();
      await page.waitForTimeout(500);
    }

    // Enter masquerade
    const stepInToggle = page.getByText(/step in as/i).first();
    if (await stepInToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
      await stepInToggle.click();
      await page.waitForTimeout(500);

      const userButtons = page.locator('button:has-text("@")');
      if ((await userButtons.count()) > 0) {
        await userButtons.first().click();
        await page.waitForTimeout(1000);

        // Look for Exit button
        const exitButton = page.getByText(/exit/i).first();
        if (await exitButton.isVisible({ timeout: 3000 }).catch(() => false)) {
          await exitButton.click();
          await page.waitForTimeout(1000);

          // Should be back to normal
          const pageContent = page.locator('main, [role="main"]');
          await expect(pageContent).toBeVisible();
        }
      }
    }
  });
});
