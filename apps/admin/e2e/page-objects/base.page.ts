import { Page, Locator, expect } from '@playwright/test';

/**
 * Base Page Object
 * Provides common methods inherited by all page objects
 */
export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  /** The URL path for this page (e.g., '/x/callers') */
  abstract readonly path: string;

  /** Navigate to this page */
  async goto(): Promise<void> {
    await this.page.goto(this.path);
    await this.waitForLoad();
  }

  /** Wait for page to be fully loaded */
  async waitForLoad(): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded');
  }

  /** Wait for network to be idle */
  async waitForNetworkIdle(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }

  /** Get element by data-testid attribute */
  getByTestId(testId: string): Locator {
    return this.page.locator(`[data-testid="${testId}"]`);
  }

  /** Get element by role */
  getByRole(role: string, options?: { name?: string | RegExp }): Locator {
    return this.page.getByRole(role as any, options);
  }

  /** Get element by text content */
  getByText(text: string | RegExp): Locator {
    return this.page.getByText(text);
  }

  /** Get page title */
  async getTitle(): Promise<string> {
    return this.page.title();
  }

  /** Get current URL */
  getURL(): string {
    return this.page.url();
  }

  /** Check if element is visible */
  async isVisible(locator: Locator): Promise<boolean> {
    return locator.isVisible();
  }

  /** Wait for element to be visible */
  async waitForVisible(locator: Locator, timeout = 5000): Promise<void> {
    await expect(locator).toBeVisible({ timeout });
  }

  /** Wait for element to be hidden */
  async waitForHidden(locator: Locator, timeout = 5000): Promise<void> {
    await expect(locator).toBeHidden({ timeout });
  }

  /** Click an element and wait for navigation */
  async clickAndWaitForNavigation(locator: Locator): Promise<void> {
    await Promise.all([
      this.page.waitForURL(/.*/, { waitUntil: 'domcontentloaded' }),
      locator.click(),
    ]);
  }

  /** Take a screenshot */
  async screenshot(name: string): Promise<void> {
    await this.page.screenshot({ path: `playwright-report/screenshots/${name}.png` });
  }
}
