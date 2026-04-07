import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Page Object for the V5 TeachWizard (/x/teach)
 *
 * Accordion-style progressive wizard:
 * Institution → Course → Goal → Upload → Review → Lesson Plan → Launch
 */
export class TeachWizardPage extends BasePage {
  readonly path = '/x/teach';

  // ── Sections ──────────────────────────────────────
  readonly page_: Page;

  // Step 1: Institution
  readonly institutionSection: Locator;
  readonly institutionDropdown: Locator;

  // Step 2: Course (teach mode only)
  readonly courseSection: Locator;
  readonly newCourseChip: Locator;
  readonly courseNameInput: Locator;
  readonly confirmCourseButton: Locator;

  // Step 3: Goal
  readonly goalTextarea: Locator;
  readonly goalSuggestionChips: Locator;

  // Step 4: Upload
  readonly uploadSection: Locator;
  readonly fileInput: Locator;
  readonly uploadDropzone: Locator;
  readonly skipUploadButton: Locator;

  // Step 5: Review
  readonly groupRows: Locator;
  readonly groupChecks: Locator;
  readonly methodBadges: Locator;

  // Step 6: Lesson Plan
  readonly lessonItems: Locator;
  readonly addLessonButton: Locator;

  // Step 7: Launch
  readonly launchButton: Locator;
  readonly launchPhases: Locator;

  // Shared
  readonly continueButtons: Locator;
  readonly spinner: Locator;
  readonly intentCards: Locator;

  constructor(page: Page) {
    super(page);
    this.page_ = page;

    // Sections
    this.institutionSection = page.locator('#institution');
    this.courseSection = page.locator('#course');

    // Step 1
    this.institutionDropdown = page.locator('.tw-domain-row');

    // Step 2
    this.newCourseChip = page.locator('.tw-chip.tw-chip-new');
    this.courseNameInput = page.locator('.tw-inline-form .tw-input');
    this.confirmCourseButton = page.locator('.tw-btn-continue');
    this.intentCards = page.locator('.tw-intent-card');

    // Step 3
    this.goalTextarea = page.locator('.tw-textarea');
    this.goalSuggestionChips = page.locator('.tw-suggestion-chip');

    // Step 4
    this.uploadSection = page.locator('.tw-pack-upload-root, .pack-upload-step');
    this.fileInput = page.locator('input[type="file"]');
    this.uploadDropzone = page.locator('.tw-upload-zone, .pack-upload-dropzone');
    this.skipUploadButton = page.getByRole('button', { name: /skip/i });

    // Step 5
    this.groupRows = page.locator('.tw-group-row');
    this.groupChecks = page.locator('.tw-group-check');
    this.methodBadges = page.locator('.tw-method-badge');

    // Step 6
    this.lessonItems = page.locator('.tw-lesson-item');
    this.addLessonButton = page.locator('.tw-add-lesson-btn');

    // Step 7
    this.launchButton = page.getByRole('button', { name: /launch|start demonstration/i });
    this.launchPhases = page.locator('.tw-launch-phase');

    // Shared
    this.continueButtons = page.locator('.tw-btn-continue');
    this.spinner = page.locator('.tw-spinner');
  }

  /** Select an institution from the dropdown by typing */
  async selectInstitution(name: string): Promise<void> {
    // Click into the FancySelect to open it, then type to filter
    const input = this.institutionDropdown.locator('input').first();
    await input.click();
    await input.fill(name);
    // Click the matching option
    await this.page_.locator(`text="${name}"`).first().click();
  }

  /** Wait for institution step to auto-complete (after selection) */
  async waitForInstitutionComplete(timeout = 10_000): Promise<void> {
    // Course step should become visible/active after institution completes
    await this.courseSection.waitFor({ state: 'visible', timeout });
  }

  /** Click "New course" chip and fill the inline form */
  async createNewCourse(name: string): Promise<void> {
    await this.newCourseChip.click();
    await this.courseNameInput.waitFor({ state: 'visible' });
    await this.courseNameInput.fill(name);
  }

  /** Select a teaching mode card by index (0=Recall, 1=Comprehension, 2=Practice, 3=Mastery) */
  async selectTeachingMode(index: number): Promise<void> {
    await this.intentCards.nth(index).click();
  }

  /** Click the Continue button in the current section */
  async clickContinue(): Promise<void> {
    // Find the first visible Continue button
    const btn = this.page_.locator('.tw-btn-continue:visible').first();
    await btn.click();
  }

  /** Fill the goal textarea */
  async fillGoal(text: string): Promise<void> {
    await this.goalTextarea.fill(text);
  }

  /** Upload a file via the file input */
  async uploadFile(filePath: string): Promise<void> {
    await this.fileInput.setInputFiles(filePath);
  }

  /** Skip the upload step */
  async skipUpload(): Promise<void> {
    await this.skipUploadButton.click();
  }

  /** Wait for extraction to complete (progress bar disappears, groups appear) */
  async waitForExtraction(timeout = 120_000): Promise<void> {
    await this.groupRows.first().waitFor({ state: 'visible', timeout });
  }

  /** Wait for launch to redirect to sim */
  async waitForSimRedirect(timeout = 60_000): Promise<void> {
    await this.page_.waitForURL(/\/x\/sim\//, { timeout });
  }
}
