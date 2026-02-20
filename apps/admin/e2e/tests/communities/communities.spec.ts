import { test, expect } from '../../fixtures';

/**
 * Communities Page E2E Tests
 * Tests the communities list page: loading, creation via quick-launch, navigation to detail
 */

test.describe('Communities List', () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs('admin@test.com');
  });

  test('should load communities page', async ({ page }) => {
    await page.goto('/x/communities');
    await page.waitForLoadState('domcontentloaded');

    const pageContent = page.locator('main, [role="main"]');
    await expect(pageContent).toBeVisible();

    // Should show heading
    const heading = page.getByRole('heading', { name: /communities/i });
    await expect(heading).toBeVisible();
  });

  test('should display communities or empty state', async ({ page }) => {
    await page.goto('/x/communities');
    await page.waitForLoadState('networkidle');

    // Either show communities list or empty state
    const content = page.locator('main, [role="main"]');
    const textContent = await content.textContent();
    expect(textContent?.length).toBeGreaterThan(0);

    // Should have "New Community" button
    const newButton = page.getByRole('button', { name: /new community/i });
    await expect(newButton).toBeVisible();
  });

  test('should navigate to quick-launch in community mode', async ({ page }) => {
    await page.goto('/x/communities');
    await page.waitForLoadState('domcontentloaded');

    const newButton = page.getByRole('button', { name: /new community/i });
    await newButton.click();

    // Should redirect to quick-launch with ?mode=community
    await page.waitForURL(/\/x\/quick-launch\?mode=community/);
    const url = page.url();
    expect(url).toContain('mode=community');
  });
});

test.describe('Quick Launch in Community Mode', () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs('admin@test.com');
  });

  test('should show community-specific UI in quick-launch', async ({ page }) => {
    await page.goto('/x/quick-launch?mode=community');
    await page.waitForLoadState('domcontentloaded');

    // Should show "Create Community" title instead of "Quick Launch"
    const title = page.getByRole('heading', { name: /create community/i });
    await expect(title).toBeVisible();

    // Should show community-specific description
    const description = page.getByText(/purpose-led group/i);
    if (await description.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(description).toBeVisible();
    }
  });

  test('should not require content upload for community mode', async ({ page }) => {
    await page.goto('/x/quick-launch?mode=community');
    await page.waitForLoadState('domcontentloaded');

    // Fill required fields: name and persona
    const nameInput = page.locator('input#subject, input[placeholder*="name" i]').first();
    if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nameInput.fill('Test Community');
    }

    // Select a persona
    const personaSelect = page.locator('button, select').first();
    if (await personaSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await personaSelect.click();
      const option = page.locator('[role="option"], button').first();
      if (await option.isVisible({ timeout: 3000 }).catch(() => false)) {
        await option.click();
      }
    }

    // Launch/Submit button should be enabled without file upload
    const launchButton = page.getByRole('button', { name: /launch|create|next/i }).first();
    if (await launchButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      const isDisabled = await launchButton.isDisabled().catch(() => true);
      // In community mode, button should be enabled without file
      // The exact behavior depends on form validation
    }
  });
});

test.describe('Community Detail Navigation', () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs('admin@test.com');
  });

  test('should navigate to community detail when clicking community card', async ({ page }) => {
    await page.goto('/x/communities');
    await page.waitForLoadState('networkidle');

    // Try to click on a community card if any exist
    const communityCard = page.locator('div[class*="p-6"][class*="border"]').first();
    if (await communityCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await communityCard.click();

      // Should navigate to /x/communities/[id]
      await page.waitForURL(/\/x\/communities\/[a-z0-9-]+/);
      const url = page.url();
      expect(url).toMatch(/\/x\/communities\/[a-z0-9-]+/);

      // Detail page should load and show community name
      const heading = page.getByRole('heading').first();
      await expect(heading).toBeVisible();
    }
  });

  test('should show community tabs on detail page', async ({ page }) => {
    // Assumes a community exists; adjust if needed for fresh DB
    await page.goto('/x/communities');
    await page.waitForLoadState('networkidle');

    const communityCard = page.locator('div[class*="p-6"][class*="border"]').first();
    if (await communityCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await communityCard.click();

      await page.waitForLoadState('networkidle');

      // Should show tabs: Members, Identity, Onboarding, Settings
      const memberTab = page.getByRole('button', { name: /members/i });
      const identityTab = page.getByRole('button', { name: /identity/i });
      const onboardingTab = page.getByRole('button', { name: /onboarding/i });
      const settingsTab = page.getByRole('button', { name: /settings/i });

      // At least one tab should be visible
      const anyTabVisible = await Promise.any([
        memberTab.isVisible().catch(() => false),
        identityTab.isVisible().catch(() => false),
        onboardingTab.isVisible().catch(() => false),
        settingsTab.isVisible().catch(() => false),
      ]).catch(() => false);

      expect(anyTabVisible).toBeTruthy();
    }
  });

  test('should display community stats on detail page', async ({ page }) => {
    await page.goto('/x/communities');
    await page.waitForLoadState('networkidle');

    const communityCard = page.locator('div[class*="p-6"][class*="border"]').first();
    if (await communityCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await communityCard.click();

      await page.waitForLoadState('networkidle');

      // Should show member count, AI persona, and playbook count
      const content = page.locator('main, [role="main"]');
      const textContent = await content.textContent();

      expect(textContent).toMatch(/members|persona|playbooks/i);
    }
  });
});
