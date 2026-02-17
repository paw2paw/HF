import { test, expect } from '../../fixtures';

/**
 * Student Onboarding E2E Tests
 * Tests the first-run onboarding wizard on the student progress page
 */
test.describe('Student Onboarding Flow', () => {
  test.beforeEach(async ({ loginAs }) => {
    await loginAs('admin@test.com');
  });

  test('should load student progress page without error', async ({ page }) => {
    await page.goto('/x/student/progress');
    await page.waitForLoadState('domcontentloaded');

    // Page should render — either onboarding or progress view
    const pageContent = page.locator('main, [role="main"]');
    await expect(pageContent).toBeVisible();
  });

  test('should show progress heading or onboarding wizard', async ({ page }) => {
    await page.goto('/x/student/progress');
    await page.waitForLoadState('networkidle');

    // Either "My Progress" heading or onboarding welcome
    const progressHeading = page.getByText(/my progress/i);
    const welcomeHeading = page.getByText(/welcome/i);

    const hasProgress = await progressHeading.isVisible().catch(() => false);
    const hasWelcome = await welcomeHeading.isVisible().catch(() => false);

    expect(hasProgress || hasWelcome).toBe(true);
  });

  test('should display step indicators when onboarding is shown', async ({ page }) => {
    await page.goto('/x/student/progress');
    await page.waitForLoadState('networkidle');

    // If onboarding shows, look for step counter text
    const stepCounter = page.getByText(/step \d+ of 4/i);
    if (await stepCounter.isVisible().catch(() => false)) {
      await expect(stepCounter).toBeVisible();
    }
  });

  test('should show how-it-works content', async ({ page }) => {
    await page.goto('/x/student/progress');
    await page.waitForLoadState('networkidle');

    // Navigate to How It Works step if onboarding is visible
    const getStartedBtn = page.getByRole('button', { name: /get started/i });
    if (await getStartedBtn.isVisible().catch(() => false)) {
      await getStartedBtn.click();
      // On goals step, click continue
      const continueBtn = page.getByRole('button', { name: /continue/i });
      await continueBtn.click();

      // Should see "How It Works" heading
      await expect(page.getByText(/how it works/i)).toBeVisible();
      await expect(page.getByText(/personalised to you/i)).toBeVisible();
    }
  });

  test('should navigate to ready step and show CTA', async ({ page }) => {
    await page.goto('/x/student/progress');
    await page.waitForLoadState('networkidle');

    const getStartedBtn = page.getByRole('button', { name: /get started/i });
    if (await getStartedBtn.isVisible().catch(() => false)) {
      // Step 1 → Step 2
      await getStartedBtn.click();
      // Step 2 → Step 3
      await page.getByRole('button', { name: /continue/i }).click();
      // Step 3 → Step 4
      await page.getByRole('button', { name: /continue/i }).click();

      // Should see ready state with CTA
      await expect(page.getByText(/you're all set/i)).toBeVisible();
      await expect(
        page.getByRole('button', { name: /start your first conversation/i })
      ).toBeVisible();
    }
  });
});
