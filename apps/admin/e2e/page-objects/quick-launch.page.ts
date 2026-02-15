import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Page Object for the Quick Launch wizard (/x/quick-launch)
 *
 * Phases: form → building → review → committing → result
 */
export class QuickLaunchPage extends BasePage {
  readonly path = '/x/quick-launch';

  // Form phase
  readonly subjectInput: Locator;
  readonly buildButton: Locator;
  readonly generateModeButton: Locator;
  readonly uploadModeButton: Locator;

  // Review phase (ReviewPanel)
  readonly reviewPanel: Locator;

  // Result phase
  readonly viewDomainButton: Locator;
  readonly viewCallerButton: Locator;
  readonly launchAnotherButton: Locator;

  constructor(page: Page) {
    super(page);

    this.subjectInput = page.locator('input#subject');
    this.buildButton = page.getByRole('button', { name: 'Build My Tutor' });
    this.generateModeButton = page.getByText('Generate with AI');
    this.uploadModeButton = page.getByText('Upload Materials');

    this.reviewPanel = page.getByText('Review what AI created');

    this.viewDomainButton = page.getByRole('button', { name: 'View Domain' });
    this.viewCallerButton = page.getByRole('button', { name: 'View Test Caller' });
    this.launchAnotherButton = page.getByRole('button', { name: 'Launch Another' });
  }

  async fillSubject(name: string): Promise<void> {
    await this.subjectInput.fill(name);
  }

  async selectGenerateMode(): Promise<void> {
    await this.generateModeButton.click();
  }

  async selectUploadMode(): Promise<void> {
    await this.uploadModeButton.click();
  }

  async clickBuild(): Promise<void> {
    await this.buildButton.click();
  }

  /** Wait for review phase — the page transitions after AI analysis */
  async waitForReviewPhase(timeout = 60_000): Promise<void> {
    await this.page.getByText('Review what AI created').waitFor({ state: 'visible', timeout });
  }

  /** Wait for the Create button to be enabled (analysis complete) */
  async waitForCreateEnabled(timeout = 30_000): Promise<void> {
    const createBtn = this.page.getByRole('button', { name: 'Create' });
    await createBtn.waitFor({ state: 'visible', timeout });
    // Wait until not disabled
    await this.page.waitForFunction(
      () => {
        const btn = document.querySelector('button') as HTMLButtonElement | null;
        // Find the Create button specifically
        const buttons = Array.from(document.querySelectorAll('button'));
        const createBtn = buttons.find(b => b.textContent?.trim() === 'Create');
        return createBtn && !createBtn.disabled;
      },
      { timeout }
    );
  }

  async clickCreate(): Promise<void> {
    await this.page.getByRole('button', { name: 'Create' }).click();
  }

  /** Wait for the result phase — "Ready to test" */
  async waitForResult(timeout = 120_000): Promise<void> {
    await this.page.getByText('Ready to test').waitFor({ state: 'visible', timeout });
  }

  /** Get the domain name from the result phase */
  async getResultDomainName(): Promise<string> {
    const text = await this.page.getByText(/domain created with/).textContent();
    return text || '';
  }
}
