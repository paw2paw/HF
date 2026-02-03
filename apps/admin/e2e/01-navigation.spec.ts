import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Basic Navigation
 *
 * Tests core navigation flows through the application
 */

test.describe('Navigation', () => {
  test('should load homepage successfully', async ({ page }) => {
    await page.goto('/');

    // Wait for page to load
    await expect(page).toHaveTitle(/HumanFirst/i);

    // Check for main navigation elements
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();
  });

  test('should navigate to callers page', async ({ page }) => {
    await page.goto('/');

    // Click on Callers nav link
    await page.click('text=Callers');

    // Verify URL changed
    await expect(page).toHaveURL(/\/callers/);

    // Verify page content loaded
    await expect(page.locator('h1')).toContainText(/Callers/i);
  });

  test('should navigate to playbooks page', async ({ page }) => {
    await page.goto('/');

    await page.click('text=Playbooks');

    await expect(page).toHaveURL(/\/playbooks/);
    await expect(page.locator('h1')).toContainText(/Playbooks/i);
  });

  test('should navigate to transcripts page', async ({ page }) => {
    await page.goto('/');

    await page.click('text=Transcripts');

    await expect(page).toHaveURL(/\/transcripts/);
    await expect(page.locator('h1')).toContainText(/Transcripts/i);
  });
});
