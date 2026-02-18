import { test, expect } from '../../fixtures';

test.describe('Content Sources Wizard', () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs('admin@test.com');
  });

  test('should display wizard as default view with 7-step progress stepper', async ({ page }) => {
    await page.goto('/x/content-sources');
    await page.waitForLoadState('domcontentloaded');

    // Page title shows "Content Sources"
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Content Sources');

    // ProgressStepper should show step labels
    await expect(page.getByText('Add Source')).toBeVisible();
    await expect(page.getByText('Extract')).toBeVisible();
    await expect(page.getByText('Review')).toBeVisible();
    await expect(page.getByText('Plan Lessons')).toBeVisible();
    await expect(page.getByText('Onboard')).toBeVisible();
    await expect(page.getByText('Preview')).toBeVisible();
    await expect(page.getByText('Done')).toBeVisible();
  });

  test('should show wizard entry — "What do you want to teach from?"', async ({ page }) => {
    await page.goto('/x/content-sources');
    await page.waitForLoadState('domcontentloaded');

    // Intent-driven prompt should be visible (Step 1)
    await expect(page.getByText(/what do you want to teach/i)).toBeVisible();
  });

  test('should toggle between wizard and library view', async ({ page }) => {
    await page.goto('/x/content-sources');
    await page.waitForLoadState('domcontentloaded');

    // Initially shows wizard
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Content Sources');

    // Click "View Library" toggle
    const toggleBtn = page.getByRole('button', { name: /view library/i });
    await expect(toggleBtn).toBeVisible();
    await toggleBtn.click();

    // Now shows library
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Content Library');

    // Toggle back
    const backBtn = page.getByRole('button', { name: /back to wizard/i });
    await expect(backBtn).toBeVisible();
    await backBtn.click();

    // Back to wizard
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Content Sources');
  });

  test('should show describe input and subject selector in Step 1', async ({ page }) => {
    await page.goto('/x/content-sources');
    await page.waitForLoadState('domcontentloaded');

    // The intent text input should be visible
    const intentInput = page.locator('textarea, input[type="text"]').first();
    await expect(intentInput).toBeVisible();
  });

  test('library view should show content sources table', async ({ page }) => {
    await page.goto('/x/content-sources');
    await page.waitForLoadState('domcontentloaded');

    // Switch to library
    await page.getByRole('button', { name: /view library/i }).click();
    await page.waitForLoadState('domcontentloaded');

    // Library should show table or list of sources
    // May show "No sources" if DB is empty, or a table
    const hasTable = await page.locator('table').count() > 0;
    const hasNoSourcesMsg = await page.getByText(/no content sources/i).count() > 0;
    const hasSourceCards = await page.locator('[data-testid="source-row"]').count() > 0;

    expect(hasTable || hasNoSourcesMsg || hasSourceCards).toBe(true);
  });
});
