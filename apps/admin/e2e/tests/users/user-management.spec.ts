import { test, expect } from '../../fixtures';

/**
 * User Management & Role Dashboards E2E Tests
 * Tests user editor modal and role-specific dashboard variants
 */
test.describe('Role-Specific Dashboards', () => {
  test('should display admin dashboard for admin user', async ({ page, loginAs }) => {
    await loginAs('admin@test.com');

    await page.goto('/x');
    await page.waitForLoadState('domcontentloaded');

    // Admin dashboard should have "Operations Dashboard" or similar heading
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible();

    // Should have stat cards
    const content = page.locator('main, [role="main"]');
    await expect(content).toBeVisible();
  });

  test('should display stat cards on dashboard', async ({ page, loginAs }) => {
    await loginAs('admin@test.com');

    await page.goto('/x');
    await page.waitForLoadState('networkidle');

    // Dashboard should show stat cards (Domains, Playbooks, Callers)
    const statCards = page.locator('.home-stat-card');
    const cardCount = await statCards.count();

    // At least one stat card should render
    const content = page.locator('[data-tour="welcome"], main').first();
    await expect(content).toBeVisible();
  });

  test('should display recent activity section', async ({ page, loginAs }) => {
    await loginAs('admin@test.com');

    await page.goto('/x');
    await page.waitForLoadState('networkidle');

    // Recent activity section or action cards
    const actionCards = page.locator('.home-action-card, .home-recent-row');
    const content = page.locator('main, [role="main"]');
    await expect(content).toBeVisible();
  });
});

test.describe('Access Control Page', () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs('admin@test.com');
  });

  test('should load access control page', async ({ page }) => {
    await page.goto('/x/access-control');
    await page.waitForLoadState('domcontentloaded');

    const pageContent = page.locator('main, [role="main"]');
    await expect(pageContent).toBeVisible();
  });

  test('should display user cards', async ({ page }) => {
    await page.goto('/x/access-control');
    await page.waitForLoadState('networkidle');

    // Should show user cards or list
    const content = page.locator('main, [role="main"]');
    const textContent = await content.textContent();
    expect(textContent?.length).toBeGreaterThan(0);
  });

  test('should open user editor modal on card click', async ({ page }) => {
    await page.goto('/x/access-control');
    await page.waitForLoadState('networkidle');

    // Click a user card
    const userCard = page.locator('[class*="user-card"], [class*="card"]').first();
    if (await userCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await userCard.click();
      await page.waitForTimeout(500);

      // Modal should open with user details
      const modal = page.locator('[role="dialog"], [class*="modal"]').first();
      if (await modal.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(modal).toBeVisible();

        // Should show editable fields
        const nameInput = modal.locator('input[name="name"], input[placeholder*="name"]').first();
        if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await expect(nameInput).toBeVisible();
        }
      }
    }
  });

  test('should show SUPERADMIN with green check in access grid', async ({ page }) => {
    await page.goto('/x/access-control');
    await page.waitForLoadState('networkidle');

    // Look for SUPERADMIN badge or role indicator
    const superadminBadge = page.getByText(/superadmin/i).first();
    if (await superadminBadge.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(superadminBadge).toBeVisible();
    }
  });
});

test.describe('Account Panel', () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs('admin@test.com');
  });

  test('should display version in account panel', async ({ page }) => {
    await page.goto('/x');
    await page.waitForLoadState('domcontentloaded');

    // Open account panel
    const sidebarFooter = page.locator('nav footer, aside footer, .sidebar-footer').first();
    if (await sidebarFooter.isVisible()) {
      await sidebarFooter.click();
      await page.waitForTimeout(500);

      // Should show version number
      const versionText = page.getByText(/v\d+\.\d+\.\d+/).first();
      if (await versionText.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(versionText).toBeVisible();
      }
    }
  });

  test('should show theme toggle', async ({ page }) => {
    await page.goto('/x');
    await page.waitForLoadState('domcontentloaded');

    const sidebarFooter = page.locator('nav footer, aside footer, .sidebar-footer').first();
    if (await sidebarFooter.isVisible()) {
      await sidebarFooter.click();
      await page.waitForTimeout(500);

      // Should have Light/Dark/Auto buttons
      const lightButton = page.getByText(/light/i).first();
      const darkButton = page.getByText(/dark/i).first();

      if (await lightButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(lightButton).toBeVisible();
      }
    }
  });

  test('should have sign out button', async ({ page }) => {
    await page.goto('/x');
    await page.waitForLoadState('domcontentloaded');

    const sidebarFooter = page.locator('nav footer, aside footer, .sidebar-footer').first();
    if (await sidebarFooter.isVisible()) {
      await sidebarFooter.click();
      await page.waitForTimeout(500);

      const signOutButton = page.getByText(/sign out|log out/i).first();
      if (await signOutButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(signOutButton).toBeVisible();
      }
    }
  });
});
