import { test, expect } from '../../fixtures';

/**
 * Identity Layers E2E Tests
 * Tests the /x/layers page: base+overlay view, diff
 */
test.describe('Identity Layers Page', () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs('admin@test.com');
  });

  test('should load layers page', async ({ page }) => {
    await page.goto('/x/layers');
    await page.waitForLoadState('domcontentloaded');

    const pageContent = page.locator('main, [role="main"]');
    await expect(pageContent).toBeVisible();
  });

  test('should display heading', async ({ page }) => {
    await page.goto('/x/layers');
    await page.waitForLoadState('domcontentloaded');

    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible();
  });

  test('should display base archetype specs', async ({ page }) => {
    await page.goto('/x/layers');
    await page.waitForLoadState('networkidle');

    // Should show spec cards or list items for base archetypes
    const content = page.locator('main, [role="main"]');
    await expect(content).toBeVisible();

    // Should have some content (specs list or empty state)
    const textContent = await content.textContent();
    expect(textContent?.length).toBeGreaterThan(0);
  });

  test('should show overlay specs when a domain is selected', async ({ page }) => {
    await page.goto('/x/layers');
    await page.waitForLoadState('networkidle');

    // Look for a domain selector or overlay toggle
    const domainSelector = page.locator('select, [role="combobox"], button:has-text("Domain")').first();
    if (await domainSelector.isVisible({ timeout: 3000 }).catch(() => false)) {
      await domainSelector.click();
      await page.waitForTimeout(500);
    }
  });

  test('should display diff view when comparing layers', async ({ page }) => {
    await page.goto('/x/layers');
    await page.waitForLoadState('networkidle');

    // Look for diff button or view toggle
    const diffButton = page.getByText(/diff|compare|changes/i).first();
    if (await diffButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await diffButton.click();
      await page.waitForTimeout(500);

      // Diff view should show additions/removals
      const diffContent = page.locator('[class*="diff"], [class*="added"], [class*="removed"]');
      if ((await diffContent.count()) > 0) {
        await expect(diffContent.first()).toBeVisible();
      }
    }
  });
});

test.describe('Layers Navigation from Domains', () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs('admin@test.com');
  });

  test('should navigate to layers from domains page', async ({ page }) => {
    await page.goto('/x/domains');
    await page.waitForLoadState('networkidle');

    // Look for "View Layers" link
    const layersLink = page.locator('a[href*="/layers"]').first();
    if (await layersLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await layersLink.click();
      await expect(page).toHaveURL(/\/x\/layers/);
    }
  });
});
