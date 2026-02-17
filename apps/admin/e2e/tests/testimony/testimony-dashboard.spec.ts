import { test, expect } from '../../fixtures';

/**
 * Testimony Dashboard E2E Tests
 * Tests the testimony dashboard page and spec detail navigation
 */
test.describe('Testimony Dashboard', () => {
  test.beforeEach(async ({ loginAs }) => {
    await loginAs('admin@test.com');
  });

  test('should load testimony dashboard', async ({ page }) => {
    await page.goto('/x/testimony');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('heading', { name: /testimony/i })).toBeVisible();
  });

  test('should display spec cards or empty state', async ({ page }) => {
    await page.goto('/x/testimony');
    await page.waitForLoadState('networkidle');

    const pageContent = page.locator('main, [role="main"]');
    await expect(pageContent).toBeVisible();

    // Either spec cards or empty state
    const hasCards = await page.locator('.home-stat-card').count() > 0;
    const hasEmptyState = await page.getByText(/no testimony data/i).isVisible().catch(() => false);

    expect(hasCards || hasEmptyState).toBe(true);
  });

  test('should have domain filter dropdown', async ({ page }) => {
    await page.goto('/x/testimony');
    await page.waitForLoadState('networkidle');

    // Domain filter should be present if domains exist
    const select = page.locator('select');
    if (await select.count() > 0) {
      await expect(select.first()).toBeVisible();
    }
  });

  test('should navigate to spec detail when clicking a card', async ({ page }) => {
    await page.goto('/x/testimony');
    await page.waitForLoadState('networkidle');

    const cards = page.locator('.home-stat-card');
    if (await cards.count() > 0) {
      await cards.first().click();
      await page.waitForLoadState('networkidle');

      // Should be on a spec detail page
      await expect(page.getByText(/back to testimony/i)).toBeVisible();
    }
  });

  test('should show download CSV button on spec detail', async ({ page }) => {
    await page.goto('/x/testimony');
    await page.waitForLoadState('networkidle');

    const cards = page.locator('.home-stat-card');
    if (await cards.count() > 0) {
      await cards.first().click();
      await page.waitForLoadState('networkidle');

      await expect(page.getByRole('button', { name: /download csv/i })).toBeVisible();
    }
  });
});
