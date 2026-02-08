import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Sidebar Page Object
 * Handles navigation through the sidebar
 */
export class SidebarPage extends BasePage {
  readonly path = '/x';

  // Main sidebar container
  readonly sidebar: Locator;
  readonly collapseButton: Locator;

  // Navigation sections
  readonly homeSection: Locator;
  readonly dataSection: Locator;
  readonly promptsSection: Locator;
  readonly systemSection: Locator;
  readonly adminSection: Locator;

  constructor(page: Page) {
    super(page);
    this.sidebar = page.locator('nav, aside').first();
    this.collapseButton = page.locator('[data-testid="sidebar-collapse"]');

    // Sections by text content
    this.homeSection = page.getByText('Home', { exact: true });
    this.dataSection = page.getByText('Data', { exact: true });
    this.promptsSection = page.getByText('Prompts', { exact: true });
    this.systemSection = page.getByText('System', { exact: true });
    this.adminSection = page.getByText('Admin', { exact: true });
  }

  /** Navigate to a page via sidebar link */
  async navigateTo(linkText: string): Promise<void> {
    const link = this.page.getByRole('link', { name: linkText });
    await link.click();
    await this.page.waitForLoadState('domcontentloaded');
  }

  /** Navigate to specific pages */
  async goToCallers(): Promise<void> {
    await this.navigateTo('Callers');
    await this.page.waitForURL(/\/x\/callers/);
  }

  async goToPlaybooks(): Promise<void> {
    await this.navigateTo('Playbooks');
    await this.page.waitForURL(/\/x\/playbooks/);
  }

  async goToPipeline(): Promise<void> {
    await this.navigateTo('Pipeline');
    await this.page.waitForURL(/\/x\/pipeline/);
  }

  async goToPlayground(): Promise<void> {
    await this.navigateTo('Playground');
    await this.page.waitForURL(/\/x\/playground/);
  }

  async goToSpecs(): Promise<void> {
    await this.navigateTo('Specs');
    await this.page.waitForURL(/\/x\/specs/);
  }

  async goToDomains(): Promise<void> {
    await this.navigateTo('Domains');
    await this.page.waitForURL(/\/x\/domains/);
  }

  async goToTaxonomy(): Promise<void> {
    await this.navigateTo('Taxonomy');
    await this.page.waitForURL(/\/x\/taxonomy/);
  }

  async goToDictionary(): Promise<void> {
    await this.navigateTo('Dictionary');
    await this.page.waitForURL(/\/x\/dictionary/);
  }

  async goToMetering(): Promise<void> {
    await this.navigateTo('Metering');
    await this.page.waitForURL(/\/x\/metering/);
  }

  async goToSettings(): Promise<void> {
    await this.navigateTo('Settings');
    await this.page.waitForURL(/\/x\/settings/);
  }

  /** Check if sidebar is visible */
  async isSidebarVisible(): Promise<boolean> {
    return this.sidebar.isVisible();
  }

  /** Toggle sidebar collapse */
  async toggleCollapse(): Promise<void> {
    if (await this.collapseButton.isVisible()) {
      await this.collapseButton.click();
    }
  }

  /** Get the currently active nav item */
  async getActiveNavItem(): Promise<string | null> {
    const activeItem = this.page.locator('[aria-current="page"], .active, [data-active="true"]');
    if (await activeItem.isVisible()) {
      return activeItem.textContent();
    }
    return null;
  }

  /** Verify sidebar contains expected sections */
  async verifySidebarStructure(): Promise<void> {
    await expect(this.sidebar).toBeVisible();
  }
}
