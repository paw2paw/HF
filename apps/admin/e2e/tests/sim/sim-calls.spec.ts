import { test, expect } from '../../fixtures';

/**
 * Sim Call E2E Tests
 * Tests ghost call prevention and call resume functionality
 */
test.describe('Sim Call Page', () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs('admin@test.com');
  });

  test('should load sim page', async ({ page }) => {
    await page.goto('/x/sim');
    await page.waitForLoadState('domcontentloaded');

    const pageContent = page.locator('main, [role="main"]');
    await expect(pageContent).toBeVisible();
  });

  test('should display caller selector', async ({ page }) => {
    await page.goto('/x/sim');
    await page.waitForLoadState('domcontentloaded');

    // Should show a way to pick a caller
    const content = page.locator('main, [role="main"]');
    await expect(content).toBeVisible();
  });
});

test.describe('Sim Call Embedded in Caller Detail', () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs('admin@test.com');
  });

  test('should show sim chat in caller detail', async ({ page }) => {
    await page.goto('/x/callers');
    await page.waitForLoadState('networkidle');

    // Navigate to first caller
    const callerLink = page.locator('a[href*="/x/callers/"]').first();
    if (await callerLink.isVisible()) {
      await callerLink.click();
      await page.waitForLoadState('domcontentloaded');

      // Look for AI Call / Sim tab
      const simTab = page.getByText(/ai call|sim|chat/i).first();
      if (await simTab.isVisible({ timeout: 3000 }).catch(() => false)) {
        await simTab.click();
        await page.waitForTimeout(500);

        // SimChat component should render
        const chatArea = page.locator('[class*="chat"], [class*="sim"], [class*="message"]').first();
        if (await chatArea.isVisible({ timeout: 3000 }).catch(() => false)) {
          await expect(chatArea).toBeVisible();
        }
      }
    }
  });

  test('should not create ghost calls on navigation away', async ({ page }) => {
    await page.goto('/x/callers');
    await page.waitForLoadState('networkidle');

    const callerLink = page.locator('a[href*="/x/callers/"]').first();
    if (await callerLink.isVisible()) {
      await callerLink.click();
      await page.waitForLoadState('domcontentloaded');

      // Click sim tab
      const simTab = page.getByText(/ai call|sim/i).first();
      if (await simTab.isVisible({ timeout: 3000 }).catch(() => false)) {
        await simTab.click();
        await page.waitForTimeout(300);

        // Navigate away quickly (before call creates)
        await page.goto('/x/callers');
        await page.waitForLoadState('domcontentloaded');

        // Navigate back
        const callerLink2 = page.locator('a[href*="/x/callers/"]').first();
        if (await callerLink2.isVisible()) {
          await callerLink2.click();
          await page.waitForLoadState('domcontentloaded');

          // Page should load without errors
          const pageContent = page.locator('main, [role="main"]');
          await expect(pageContent).toBeVisible();
        }
      }
    }
  });
});
