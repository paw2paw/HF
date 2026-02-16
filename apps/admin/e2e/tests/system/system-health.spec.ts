import { test, expect } from '../../fixtures';

/**
 * System Health Panel E2E Tests
 *
 * Tests the System Health page at /x/system which includes:
 * - SystemHealthPanel (fetches /api/system/ini)
 * - RAG status badge (or error for non-SUPERADMIN)
 * - Check groups by severity (critical, recommended, optional)
 * - Stat cards and quick link cards
 */
test.describe('System Health', () => {
  test.beforeEach(async ({ loginAs }) => {
    await loginAs('admin@test.com');
  });

  test('page loads with heading', async ({ page }) => {
    await page.goto('/x/system');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('h1')).toContainText('System');
  });

  test('health panel is visible with System Health title', async ({ page }) => {
    await page.goto('/x/system');
    await page.waitForLoadState('domcontentloaded');

    // Use .first() to handle any brief DOM transition duplicates
    const panel = page.getByTestId('system-health-panel').first();
    await expect(panel).toBeVisible({ timeout: 15000 });
    await expect(panel).toContainText('System Health');
  });

  test('health panel resolves to RAG status or error', async ({ page }) => {
    await page.goto('/x/system');
    await page.waitForLoadState('domcontentloaded');

    const panel = page.getByTestId('system-health-panel').first();
    await expect(panel).toBeVisible({ timeout: 15000 });

    // Wait for loading to finish — either RAG badge or error appears
    const ragBadge = page.getByTestId('system-health-rag-badge');
    const errorMsg = page.getByTestId('system-health-error');
    await expect(ragBadge.or(errorMsg)).toBeVisible({ timeout: 15000 });

    if (await ragBadge.isVisible()) {
      const text = await ragBadge.textContent();
      expect(['All Clear', 'Warnings', 'Issues Found'].some(l => text?.includes(l))).toBe(true);
    }

    if (await errorMsg.isVisible()) {
      await expect(errorMsg).not.toBeEmpty();
    }
  });

  test('health panel shows data-status or error when loaded', async ({ page }) => {
    await page.goto('/x/system');
    await page.waitForLoadState('domcontentloaded');

    const ragBadge = page.getByTestId('system-health-rag-badge');
    const errorMsg = page.getByTestId('system-health-error');
    await expect(ragBadge.or(errorMsg)).toBeVisible({ timeout: 15000 });

    if (await ragBadge.isVisible()) {
      // Panel with data has data-status attribute
      const panel = page.locator('[data-testid="system-health-panel"][data-status]');
      const status = await panel.getAttribute('data-status');
      expect(['green', 'amber', 'red']).toContain(status);
    }
  });

  test('severity groups and check items render when SUPERADMIN', async ({ page }) => {
    await page.goto('/x/system');
    await page.waitForLoadState('domcontentloaded');

    const ragBadge = page.getByTestId('system-health-rag-badge');
    const errorMsg = page.getByTestId('system-health-error');
    await expect(ragBadge.or(errorMsg)).toBeVisible({ timeout: 15000 });

    // Only test severity groups if RAG badge appeared (SUPERADMIN access)
    if (await ragBadge.isVisible()) {
      const criticalGroup = page.getByTestId('system-health-group-critical');
      await expect(criticalGroup).toBeVisible();
      await expect(criticalGroup).toContainText('Critical');

      const checkItems = page.getByTestId('system-health-check');
      const count = await checkItems.count();
      expect(count).toBeGreaterThanOrEqual(5);

      for (let i = 0; i < count; i++) {
        const status = await checkItems.nth(i).getAttribute('data-check-status');
        expect(['pass', 'warn', 'fail']).toContain(status);
      }
    }
  });

  test('stat cards show key metrics', async ({ page }) => {
    await page.goto('/x/system');
    await page.waitForLoadState('domcontentloaded');

    // Stat cards have class .home-stat-card
    const statCards = page.locator('.home-stat-card');
    const count = await statCards.count();
    expect(count).toBeGreaterThanOrEqual(4);

    // Verify key stat labels are present (use .first() to handle any DOM duplicates)
    await expect(statCards.filter({ hasText: 'Team Members' }).first()).toBeVisible();
    await expect(statCards.filter({ hasText: 'AI Configs' }).first()).toBeVisible();
    await expect(statCards.filter({ hasText: 'Pipeline Runs' }).first()).toBeVisible();
  });

  test('quick link cards are present', async ({ page }) => {
    await page.goto('/x/system');
    await page.waitForLoadState('domcontentloaded');

    // Quick link cards have unique description text
    await expect(page.getByRole('link', { name: /Monitor API usage/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Configure AI models/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Manage team members/i })).toBeVisible();
  });
});
