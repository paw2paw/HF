import { test, expect } from '@playwright/test';
import { LoginPage } from '../../page-objects';
import { TestUsers } from '../../fixtures';

/**
 * Authentication Tests
 * Tests login flows and route protection
 */
test.describe('Authentication', () => {
  test.describe('Login Flow', () => {
    test('should display login page with email and password fields', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();

      await loginPage.verifyOnLoginPage();
      await expect(page.getByText('Sign in to your account')).toBeVisible();
    });

    test('should login with valid credentials', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();

      await loginPage.loginAndWaitForDashboard(
        TestUsers.ADMIN.email,
        TestUsers.ADMIN.password
      );

      // Verify redirected to /x
      expect(page.url()).toMatch(/\/x/);
    });

    test('should show error for invalid password', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();

      await loginPage.login(TestUsers.ADMIN.email, 'wrong-password');

      // Wait for error message
      await expect(loginPage.errorMessage).toBeVisible({ timeout: 5000 });
      const errorText = await loginPage.getErrorMessage();
      expect(errorText).toContain('Login failed');
    });

    test('should disable submit button when fields are empty', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();

      // Initially disabled
      await expect(loginPage.submitButton).toBeDisabled();

      // Fill email only
      await loginPage.fillEmail('test@example.com');
      await expect(loginPage.submitButton).toBeDisabled();

      // Fill password
      await loginPage.fillPassword('password123');
      await expect(loginPage.submitButton).toBeEnabled();
    });

    test('should switch to magic link mode', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();

      await loginPage.switchToMagicLinkMode();
      await loginPage.verifyMagicLinkMode();

      // Switch back
      await loginPage.switchToPasswordMode();
      await loginPage.verifyOnLoginPage();
    });

    test('should redirect to callbackUrl after login', async ({ page }) => {
      // Go to protected route first
      await page.goto('/x/playbooks');

      // Should redirect to login with callbackUrl
      await expect(page).toHaveURL(/\/login/);

      const loginPage = new LoginPage(page);
      await loginPage.login(TestUsers.ADMIN.email, TestUsers.ADMIN.password);

      // Should redirect back to playbooks
      await page.waitForURL(/\/x\/playbooks/, { timeout: 10000 });
    });
  });

  test.describe('Route Protection', () => {
    test('should redirect unauthenticated users to login', async ({ page }) => {
      // Clear any existing auth
      await page.context().clearCookies();

      await page.goto('/x/callers');
      await expect(page).toHaveURL(/\/login/);
    });

    test('should protect all /x/* routes', async ({ page }) => {
      await page.context().clearCookies();

      const protectedRoutes = [
        '/x',
        '/x/callers',
        '/x/playbooks',
        '/x/pipeline',
        '/x/specs',
        '/x/domains',
      ];

      for (const route of protectedRoutes) {
        await page.goto(route);
        await expect(page).toHaveURL(/\/login/);
      }
    });

    test('should allow access to login page', async ({ page }) => {
      await page.context().clearCookies();

      await page.goto('/login');
      await expect(page).toHaveURL(/\/login/);

      const loginPage = new LoginPage(page);
      await loginPage.verifyOnLoginPage();
    });
  });
});
