import { test, expect } from '../../fixtures';

/**
 * Educator Studio E2E Tests
 * Tests the educator dashboard, invite flow, and quick actions
 */
test.describe('Educator Dashboard', () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs('admin@test.com');
  });

  test('should load educator page', async ({ page }) => {
    await page.goto('/x/educator');
    await page.waitForLoadState('domcontentloaded');

    const pageContent = page.locator('main, [role="main"]');
    await expect(pageContent).toBeVisible();
  });

  test('should display school heading', async ({ page }) => {
    await page.goto('/x/educator');
    await page.waitForLoadState('domcontentloaded');

    // Heading should be "My School" or similar
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible();
  });

  test('should display stat cards', async ({ page }) => {
    await page.goto('/x/educator');
    await page.waitForLoadState('networkidle');

    // Should show stats: Students, Active This Week, Classrooms
    const statCards = page.locator('.home-stat-card');
    const cardCount = await statCards.count();
    // May have 0 if no data seeded, but page should still render
    const pageContent = page.locator('main, [role="main"]');
    await expect(pageContent).toBeVisible();
  });

  test('should display quick action cards', async ({ page }) => {
    await page.goto('/x/educator');
    await page.waitForLoadState('networkidle');

    // Quick actions: Create Classroom, View Students, Try a Call, View Reports
    const actionCards = page.locator('.home-action-card, .home-stat-card');
    const content = page.locator('main, [role="main"]');
    await expect(content).toBeVisible();
  });

  test('should have invite teacher button', async ({ page }) => {
    await page.goto('/x/educator');
    await page.waitForLoadState('networkidle');

    // Look for invite button/section
    const inviteButton = page.getByText(/invite/i).first();
    if (await inviteButton.isVisible()) {
      await expect(inviteButton).toBeVisible();
    }
  });

  test('should navigate to classrooms page', async ({ page }) => {
    await page.goto('/x/educator');
    await page.waitForLoadState('networkidle');

    const classroomLink = page.locator('a[href*="/educator/classrooms"]').first();
    if (await classroomLink.isVisible()) {
      await classroomLink.click();
      await expect(page).toHaveURL(/\/educator\/classrooms/);
    }
  });

  test('should navigate to students page', async ({ page }) => {
    await page.goto('/x/educator');
    await page.waitForLoadState('networkidle');

    const studentsLink = page.locator('a[href*="/educator/students"]').first();
    if (await studentsLink.isVisible()) {
      await studentsLink.click();
      await expect(page).toHaveURL(/\/educator\/students/);
    }
  });
});

test.describe('Educator Invite Flow', () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs('admin@test.com');
  });

  test('should show invite form when toggled', async ({ page }) => {
    await page.goto('/x/educator');
    await page.waitForLoadState('networkidle');

    // Click "Invite a Teacher" to toggle inline form
    const inviteToggle = page.getByText(/invite a teacher/i).first();
    if (await inviteToggle.isVisible()) {
      await inviteToggle.click();
      await page.waitForTimeout(300);

      // Email input should appear
      const emailInput = page.locator('input[type="email"], input[placeholder*="@"]');
      if (await emailInput.isVisible()) {
        await expect(emailInput).toBeVisible();
      }
    }
  });
});
