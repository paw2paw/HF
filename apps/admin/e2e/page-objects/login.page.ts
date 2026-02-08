import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Login Page Object
 * Handles authentication flows
 */
export class LoginPage extends BasePage {
  readonly path = '/login';

  // Locators
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;
  readonly magicLinkButton: Locator;
  readonly passwordModeButton: Locator;
  readonly loadingSpinner: Locator;

  constructor(page: Page) {
    super(page);
    this.emailInput = page.locator('#email');
    this.passwordInput = page.locator('#password');
    this.submitButton = page.locator('button[type="submit"]');
    this.errorMessage = page.locator('.text-red-400');
    this.magicLinkButton = page.getByText('Use magic link instead');
    this.passwordModeButton = page.getByText('Use password instead');
    this.loadingSpinner = page.locator('.animate-spin');
  }

  /** Fill email field */
  async fillEmail(email: string): Promise<void> {
    await this.emailInput.fill(email);
  }

  /** Fill password field */
  async fillPassword(password: string): Promise<void> {
    await this.passwordInput.fill(password);
  }

  /** Click submit button */
  async submit(): Promise<void> {
    await this.submitButton.click();
  }

  /** Login with credentials */
  async login(email: string, password: string): Promise<void> {
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.submit();
  }

  /** Login and wait for redirect to /x */
  async loginAndWaitForDashboard(email: string, password: string): Promise<void> {
    await this.login(email, password);
    await this.page.waitForURL(/\/x/, { timeout: 10000 });
  }

  /** Switch to magic link mode */
  async switchToMagicLinkMode(): Promise<void> {
    await this.magicLinkButton.click();
  }

  /** Switch to password mode */
  async switchToPasswordMode(): Promise<void> {
    await this.passwordModeButton.click();
  }

  /** Get error message text */
  async getErrorMessage(): Promise<string | null> {
    if (await this.errorMessage.isVisible()) {
      return this.errorMessage.textContent();
    }
    return null;
  }

  /** Check if submit button is enabled */
  async isSubmitEnabled(): Promise<boolean> {
    return this.submitButton.isEnabled();
  }

  /** Check if loading spinner is visible */
  async isLoading(): Promise<boolean> {
    return this.loadingSpinner.isVisible();
  }

  /** Verify we're on the login page */
  async verifyOnLoginPage(): Promise<void> {
    await expect(this.emailInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.submitButton).toBeVisible();
  }

  /** Verify magic link mode is active */
  async verifyMagicLinkMode(): Promise<void> {
    await expect(this.emailInput).toBeVisible();
    await expect(this.passwordInput).not.toBeVisible();
    await expect(this.submitButton).toContainText('Send magic link');
  }
}
