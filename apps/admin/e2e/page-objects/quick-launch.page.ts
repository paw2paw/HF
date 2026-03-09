import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Page Object for the Quick Launch wizard (/x/quick-launch)
 *
 * Phases: form → committing → result
 */
export class QuickLaunchPage extends BasePage {
  readonly path = '/x/quick-launch';

  // Form phase
  readonly briefInput: Locator;
  readonly communityNameInput: Locator;
  readonly buildButton: Locator;

  // Result phase
  readonly viewCommunityLink: Locator;
  readonly tryItLink: Locator;
  readonly launchAnotherButton: Locator;

  constructor(page: Page) {
    super(page);

    this.briefInput = page.locator('textarea#brief');
    this.communityNameInput = page.getByRole('textbox', { name: 'Community name' });
    this.buildButton = page.getByRole('button', { name: 'Build It' });

    this.viewCommunityLink = page.getByRole('link', { name: 'View Community' });
    this.tryItLink = page.getByRole('main').getByRole('link', { name: 'Try It' });
    this.launchAnotherButton = page.getByRole('main').getByRole('button', { name: 'Launch Another' }).first();
  }

  /** Dismiss the "Resume previous launch?" prompt by clicking Start Fresh (if visible) */
  async dismissResumePrompt(): Promise<void> {
    const startFresh = this.page.getByRole('button', { name: 'Start Fresh' });
    if (await startFresh.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await startFresh.click();
      await this.page.waitForTimeout(500);
    }
  }

  /** Fill the description textarea (brief) */
  async fillBrief(description: string): Promise<void> {
    await this.briefInput.fill(description);
  }

  /** Fill the community name input */
  async fillCommunityName(name: string): Promise<void> {
    await this.communityNameInput.fill(name);
  }

  /** Fill both brief and community name — the minimum to enable Build */
  async fillForm(description: string, communityName: string): Promise<void> {
    await this.fillBrief(description);
    await this.fillCommunityName(communityName);
  }

  async clickBuild(): Promise<void> {
    await this.buildButton.click();
  }

  /** Wait for the result phase — "Your Community is Ready!" or "Topic Added to Community!" */
  async waitForResult(timeout = 120_000): Promise<void> {
    await this.page.getByRole('heading', { name: /Community is Ready|Topic Added/i }).waitFor({ state: 'visible', timeout });
  }

  /** Click "Try It" and extract the callerId from the resulting URL */
  async navigateToTestCaller(): Promise<string> {
    await Promise.all([
      this.page.waitForURL(/\/x\/sim\//, { timeout: 15_000 }),
      this.tryItLink.click(),
    ]);
    const match = this.page.url().match(/\/x\/sim\/([a-f0-9-]+)/);
    if (!match) throw new Error(`Could not extract callerId from URL: ${this.page.url()}`);
    return match[1];
  }
}
