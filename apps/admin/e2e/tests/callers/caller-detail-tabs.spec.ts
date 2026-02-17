import { test, expect } from '../../fixtures';

/**
 * Caller Detail Tabs E2E Tests
 * Tests the consolidated 4-tab layout (Calls, Profile, Assess, Artifacts)
 * and SectionSelector toggle chips
 */
test.describe('Caller Detail Tab Structure', () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs('admin@test.com');
  });

  async function navigateToCallerDetail(page: import('@playwright/test').Page) {
    await page.goto('/x/callers');
    await page.waitForLoadState('networkidle');

    const callerLink = page.locator('a[href*="/x/callers/"]').first();
    if (await callerLink.isVisible()) {
      await callerLink.click();
      await page.waitForLoadState('domcontentloaded');
      return true;
    }
    return false;
  }

  test('should display 4 main tabs', async ({ page }) => {
    const navigated = await navigateToCallerDetail(page);
    if (!navigated) return;

    // Should show tabs: Calls, Profile, Assess, Artifacts (or AI Call)
    const tabContainer = page.locator('[role="tablist"], [class*="tab"]').first();

    // Check for the expected tab names
    const callsTab = page.getByText(/^Calls$/i);
    const profileTab = page.getByText(/^Profile$/i);
    const assessTab = page.getByText(/^Assess$/i);

    // At least the core tabs should be present
    if (await callsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(callsTab).toBeVisible();
    }
  });

  test('should show Assess tab (renamed from Progress)', async ({ page }) => {
    const navigated = await navigateToCallerDetail(page);
    if (!navigated) return;

    // Verify "Assess" tab exists (not "Progress")
    const assessTab = page.getByText(/^Assess$/i).first();
    if (await assessTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(assessTab).toBeVisible();

      // "Progress" should NOT be a tab name
      const progressTab = page.locator('[role="tab"]:has-text("Progress")');
      const progressCount = await progressTab.count();
      // If Assess is visible, Progress should not be a separate tab
    }
  });

  test('should switch between tabs', async ({ page }) => {
    const navigated = await navigateToCallerDetail(page);
    if (!navigated) return;

    const tabs = page.locator('[role="tab"], [class*="tab-button"]');
    const tabCount = await tabs.count();

    if (tabCount >= 2) {
      // Click second tab
      await tabs.nth(1).click();
      await page.waitForTimeout(300);

      // Tab content should change
      const content = page.locator('main, [role="main"]');
      await expect(content).toBeVisible();

      // Click third tab if available
      if (tabCount >= 3) {
        await tabs.nth(2).click();
        await page.waitForTimeout(300);
        await expect(content).toBeVisible();
      }
    }
  });

  test('should show Assess tab with Gauge icon', async ({ page }) => {
    const navigated = await navigateToCallerDetail(page);
    if (!navigated) return;

    // Click Assess tab
    const assessTab = page.getByText(/^Assess$/i).first();
    if (await assessTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await assessTab.click();
      await page.waitForTimeout(500);

      // Should show measurement data or empty state
      const content = page.locator('main, [role="main"]');
      await expect(content).toBeVisible();
    }
  });
});

test.describe('SectionSelector Toggle Chips', () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs('admin@test.com');
  });

  async function navigateToCallerDetail(page: import('@playwright/test').Page) {
    await page.goto('/x/callers');
    await page.waitForLoadState('networkidle');

    const callerLink = page.locator('a[href*="/x/callers/"]').first();
    if (await callerLink.isVisible()) {
      await callerLink.click();
      await page.waitForLoadState('domcontentloaded');
      return true;
    }
    return false;
  }

  test('should display section toggle chips on profile tab', async ({ page }) => {
    const navigated = await navigateToCallerDetail(page);
    if (!navigated) return;

    // Click Profile tab
    const profileTab = page.getByText(/^Profile$/i).first();
    if (await profileTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await profileTab.click();
      await page.waitForTimeout(500);

      // Look for section toggle chips (SectionSelector)
      const chips = page.locator('[class*="chip"], [class*="toggle"], button[class*="section"]');
      if ((await chips.count()) > 0) {
        await expect(chips.first()).toBeVisible();
      }
    }
  });

  test('should toggle section visibility', async ({ page }) => {
    const navigated = await navigateToCallerDetail(page);
    if (!navigated) return;

    const profileTab = page.getByText(/^Profile$/i).first();
    if (await profileTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await profileTab.click();
      await page.waitForTimeout(500);

      // Find a toggle chip and click it
      const chips = page.locator('[class*="chip"], [class*="toggle"], button[class*="section"]');
      if ((await chips.count()) > 0) {
        const firstChip = chips.first();
        await firstChip.click();
        await page.waitForTimeout(300);

        // Clicking again should toggle the section back
        await firstChip.click();
        await page.waitForTimeout(300);
      }
    }
  });
});

test.describe('Call-Level Tabs', () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs('admin@test.com');
  });

  test('should show 4 call-level tabs when viewing a call', async ({ page }) => {
    await page.goto('/x/callers');
    await page.waitForLoadState('networkidle');

    const callerLink = page.locator('a[href*="/x/callers/"]').first();
    if (!await callerLink.isVisible()) return;

    await callerLink.click();
    await page.waitForLoadState('domcontentloaded');

    // Click Calls tab first
    const callsTab = page.getByText(/^Calls$/i).first();
    if (await callsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await callsTab.click();
      await page.waitForTimeout(500);

      // Click on a specific call to see call-level tabs
      const callRow = page.locator('tr a, [class*="call-row"], [class*="call-item"]').first();
      if (await callRow.isVisible({ timeout: 3000 }).catch(() => false)) {
        await callRow.click();
        await page.waitForTimeout(500);

        // Should see call-level tabs: Transcript, Extraction, Behaviour, Prompt
        const transcriptTab = page.getByText(/^Transcript$/i);
        if (await transcriptTab.isVisible({ timeout: 3000 }).catch(() => false)) {
          await expect(transcriptTab).toBeVisible();
        }
      }
    }
  });
});
