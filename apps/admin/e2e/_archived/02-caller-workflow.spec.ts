import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Caller Workflow
 *
 * Tests the complete caller management workflow
 */

test.describe('Caller Management', () => {
  test('should view caller list', async ({ page }) => {
    await page.goto('/callers');

    // Wait for callers to load
    await page.waitForSelector('[data-testid="caller-list"]', { timeout: 10000 });

    // Check that at least one caller is displayed
    const callers = await page.locator('[data-testid="caller-card"]').count();
    expect(callers).toBeGreaterThan(0);
  });

  test('should view caller details', async ({ page }) => {
    await page.goto('/callers');

    // Wait for list to load
    await page.waitForSelector('[data-testid="caller-card"]');

    // Click on first caller
    await page.locator('[data-testid="caller-card"]').first().click();

    // Verify caller detail page loaded
    await expect(page).toHaveURL(/\/callers\/.+/);
    await expect(page.locator('h1')).toBeVisible();

    // Check for caller info sections
    await expect(page.locator('text=Calls')).toBeVisible();
    await expect(page.locator('text=Memories')).toBeVisible();
  });

  test('should open chat panel from caller page', async ({ page }) => {
    await page.goto('/callers');

    // Navigate to a caller
    await page.locator('[data-testid="caller-card"]').first().click();

    // Open chat panel (Cmd+K on Mac, Ctrl+K on Windows)
    await page.keyboard.press('Meta+K');

    // Verify chat panel opened
    await expect(page.locator('[data-testid="chat-panel"]')).toBeVisible();

    // Verify caller context is shown in breadcrumbs
    const breadcrumbs = page.locator('[data-testid="chat-breadcrumbs"]');
    await expect(breadcrumbs).toContainText(/caller:/i);
  });
});
