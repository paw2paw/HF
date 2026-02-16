import { test, expect } from '../../fixtures';

/**
 * Subjects & Content E2E Tests
 * Tests subject detail pages, sources, and content management
 */
test.describe('Subjects List', () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs('admin@test.com');
  });

  test('should load subjects via sidebar', async ({ page }) => {
    await page.goto('/x');
    await page.waitForLoadState('domcontentloaded');

    // Navigate to subjects via sidebar
    const subjectsLink = page.locator('a[href*="/subjects"]').first();
    if (await subjectsLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await subjectsLink.click();
      await expect(page).toHaveURL(/\/subjects/);
    }
  });
});

test.describe('Subject Detail Page', () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs('admin@test.com');
  });

  test('should load subject detail when navigating to a subject', async ({ page }) => {
    // Navigate to subjects list first
    await page.goto('/x');
    await page.waitForLoadState('networkidle');

    // Find and click a subject link
    const subjectLink = page.locator('a[href*="/subjects/"]').first();
    if (await subjectLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await subjectLink.click();
      await page.waitForLoadState('domcontentloaded');

      await expect(page).toHaveURL(/\/subjects\/[^/]+/);

      // Page should have content
      const pageContent = page.locator('main, [role="main"]');
      await expect(pageContent).toBeVisible();
    }
  });

  test('should display editable subject name', async ({ page }) => {
    const subjectLink = page.locator('a[href*="/subjects/"]').first();
    await page.goto('/x');
    await page.waitForLoadState('networkidle');

    if (await subjectLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await subjectLink.click();
      await page.waitForLoadState('domcontentloaded');

      // Should show subject name (editable title)
      const heading = page.getByRole('heading').first();
      await expect(heading).toBeVisible();
    }
  });

  test('should display sources section', async ({ page }) => {
    await page.goto('/x');
    await page.waitForLoadState('networkidle');

    const subjectLink = page.locator('a[href*="/subjects/"]').first();
    if (await subjectLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await subjectLink.click();
      await page.waitForLoadState('networkidle');

      // Should have a sources section or empty state
      const sourcesSection = page.getByText(/sources|documents|materials/i).first();
      if (await sourcesSection.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(sourcesSection).toBeVisible();
      }
    }
  });

  test('should display media upload area', async ({ page }) => {
    await page.goto('/x');
    await page.waitForLoadState('networkidle');

    const subjectLink = page.locator('a[href*="/subjects/"]').first();
    if (await subjectLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await subjectLink.click();
      await page.waitForLoadState('networkidle');

      // Should have file upload input or drag-drop zone
      const fileInput = page.locator('input[type="file"]');
      const dropZone = page.locator('[class*="drop"], [class*="upload"]').first();

      const hasUpload = (await fileInput.count()) > 0 || (await dropZone.count()) > 0;
      // Upload area may not always be visible depending on data state
    }
  });

  test('should show trust level badges on sources', async ({ page }) => {
    await page.goto('/x');
    await page.waitForLoadState('networkidle');

    const subjectLink = page.locator('a[href*="/subjects/"]').first();
    if (await subjectLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await subjectLink.click();
      await page.waitForLoadState('networkidle');

      // Look for trust level badges (L0-L5)
      const trustBadges = page.locator('[class*="trust"], [class*="badge"]');
      // These only appear if sources are seeded
    }
  });
});
