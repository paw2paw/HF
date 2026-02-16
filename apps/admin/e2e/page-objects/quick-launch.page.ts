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
  readonly briefInput: Locator;
  readonly agentNameInput: Locator;
  readonly buildButton: Locator;
  readonly generateModeButton: Locator;
  readonly uploadModeButton: Locator;

  /** @deprecated Use briefInput + agentNameInput instead */
  readonly subjectInput: Locator;

  // Review phase (ReviewPanel)
  readonly reviewPanel: Locator;

  // Result phase
  readonly viewAgentButton: Locator;
  readonly viewCallerButton: Locator;
  readonly editIdentityButton: Locator;
  readonly createClassroomButton: Locator;
  readonly launchAnotherButton: Locator;

  /** @deprecated Use viewAgentButton instead */
  readonly viewDomainButton: Locator;

  constructor(page: Page) {
    super(page);

    this.briefInput = page.locator('textarea#brief');
    this.agentNameInput = page.getByRole('textbox', { name: 'Agent name' });
    this.buildButton = page.getByRole('button', { name: 'Build It' });
    this.generateModeButton = page.getByText('Generate with AI');
    this.uploadModeButton = page.getByText('Upload Materials');

    // Legacy alias
    this.subjectInput = this.briefInput;

    this.reviewPanel = page.getByText('Review what AI created');

    this.viewAgentButton = page.getByRole('button', { name: 'View Agent' });
    this.viewCallerButton = page.getByRole('button', { name: 'View Test Caller' });
    this.editIdentityButton = page.getByRole('button', { name: 'Edit Identity' });
    this.createClassroomButton = page.getByRole('button', { name: 'Create Classroom' });
    this.launchAnotherButton = page.getByRole('button', { name: 'Launch Another' });

    // Legacy alias
    this.viewDomainButton = this.viewAgentButton;
  }

  /** Fill the description textarea (brief) */
  async fillBrief(description: string): Promise<void> {
    await this.briefInput.fill(description);
  }

  /** Fill the agent name input */
  async fillAgentName(name: string): Promise<void> {
    await this.agentNameInput.fill(name);
  }

  /** Fill both brief and agent name — the minimum to enable Build */
  async fillForm(description: string, agentName: string): Promise<void> {
    await this.fillBrief(description);
    await this.fillAgentName(agentName);
  }

  /** @deprecated Use fillBrief instead */
  async fillSubject(name: string): Promise<void> {
    await this.fillBrief(name);
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
