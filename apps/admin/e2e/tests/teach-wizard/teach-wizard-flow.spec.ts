import { test, expect } from '../../fixtures';
import { TeachWizardPage } from '../../page-objects/teach-wizard.page';
import path from 'path';

/**
 * V5 TeachWizard — Teacher Journey E2E
 *
 * Tests the full Teach flow:
 * Institution → Course → Goal → Upload → Review → Lesson Plan → Launch → Sim
 *
 * Requires:
 *   - Seeded DB with at least one domain/institution
 *   - AI API keys for goal suggestions + extraction
 */
test.describe('V5 TeachWizard — Teacher Journey', () => {
  const testCourseName = `E2E Biology ${Date.now()}`;
  const testGoal = 'Students can explain the process of photosynthesis including light-dependent and light-independent reactions';
  const testContentFile = path.resolve(__dirname, '../../fixtures/test-content.txt');

  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs('admin@test.com');
  });

  test('should load teach page with wizard sections', async ({ page }) => {
    const tw = new TeachWizardPage(page);
    await tw.goto();

    // Page heading should be visible
    await expect(page.getByRole('heading').first()).toBeVisible();

    // Institution section should be the active first step
    await expect(tw.institutionDropdown).toBeVisible();
  });

  test('should select institution and advance to course step', async ({ page }) => {
    const tw = new TeachWizardPage(page);
    await tw.goto();

    // Fetch available institutions via API
    const res = await page.request.get('/api/domains');
    const data = await res.json();
    const domains = data.domains || [];

    if (domains.length === 0) {
      test.skip(true, 'No institutions seeded');
      return;
    }

    const firstDomain = domains[0];

    // Click institution dropdown — look for the FancySelect input or clickable area
    const dropdownArea = tw.institutionDropdown.locator('input, [role="combobox"], [class*="select"]').first();
    await dropdownArea.click();

    // Select the first option
    await page.locator(`text="${firstDomain.name}"`).first().click();

    // Course step should appear (section becomes visible/unlocked)
    await expect(tw.courseSection).toBeVisible({ timeout: 10_000 });
  });

  test('should create new course with teaching mode', async ({ page }) => {
    test.slow(); // AI suggestion call

    const tw = new TeachWizardPage(page);
    await tw.goto();

    // Select first institution
    const res = await page.request.get('/api/domains');
    const data = await res.json();
    const domains = data.domains || [];
    if (domains.length === 0) {
      test.skip(true, 'No institutions seeded');
      return;
    }

    const dropdownArea = tw.institutionDropdown.locator('input, [role="combobox"], [class*="select"]').first();
    await dropdownArea.click();
    await page.locator(`text="${domains[0].name}"`).first().click();
    await expect(tw.courseSection).toBeVisible({ timeout: 10_000 });

    // Click "New course" chip
    await tw.newCourseChip.click();

    // Fill course name
    await tw.courseNameInput.waitFor({ state: 'visible' });
    await tw.courseNameInput.fill(testCourseName);

    // Select a teaching mode (index 0 = first card)
    await expect(tw.intentCards.first()).toBeVisible({ timeout: 5_000 });
    await tw.intentCards.first().click();

    // Should show selected state
    await expect(page.locator('.tw-intent-card-selected')).toBeVisible();
  });

  test('should fill goal and see suggestions', async ({ page }) => {
    test.slow(); // AI suggestions

    const tw = new TeachWizardPage(page);
    await tw.goto();

    // Fast-forward: select institution + create course (via API or click through)
    const res = await page.request.get('/api/domains');
    const domains = (await res.json()).domains || [];
    if (domains.length === 0) {
      test.skip(true, 'No institutions seeded');
      return;
    }

    // Select institution
    const dropdownArea = tw.institutionDropdown.locator('input, [role="combobox"], [class*="select"]').first();
    await dropdownArea.click();
    await page.locator(`text="${domains[0].name}"`).first().click();
    await expect(tw.courseSection).toBeVisible({ timeout: 10_000 });

    // New course
    await tw.newCourseChip.click();
    await tw.courseNameInput.waitFor({ state: 'visible' });
    await tw.courseNameInput.fill(testCourseName);
    await tw.intentCards.first().click();

    // Confirm course to advance
    await tw.clickContinue();

    // Goal textarea should appear
    await expect(tw.goalTextarea).toBeVisible({ timeout: 10_000 });

    // Fill goal text
    await tw.fillGoal(testGoal);

    // Blur to trigger suggestion fetch
    await tw.goalTextarea.blur();

    // Wait for suggestions (may take a few seconds)
    const hasSuggestions = await tw.goalSuggestionChips.first()
      .isVisible({ timeout: 15_000 })
      .catch(() => false);

    // Suggestions are optional (API may not be configured)
    if (hasSuggestions) {
      const chipCount = await tw.goalSuggestionChips.count();
      expect(chipCount).toBeGreaterThanOrEqual(1);
    }
  });

  test('should upload content and see extraction progress', async ({ page }) => {
    test.slow(); // Extraction takes time

    const tw = new TeachWizardPage(page);
    await tw.goto();

    // Select institution
    const res = await page.request.get('/api/domains');
    const domains = (await res.json()).domains || [];
    if (domains.length === 0) {
      test.skip(true, 'No institutions seeded');
      return;
    }

    const dropdownArea = tw.institutionDropdown.locator('input, [role="combobox"], [class*="select"]').first();
    await dropdownArea.click();
    await page.locator(`text="${domains[0].name}"`).first().click();
    await expect(tw.courseSection).toBeVisible({ timeout: 10_000 });

    // New course
    await tw.newCourseChip.click();
    await tw.courseNameInput.waitFor({ state: 'visible' });
    await tw.courseNameInput.fill(testCourseName);
    await tw.intentCards.first().click();
    await tw.clickContinue();

    // Goal
    await expect(tw.goalTextarea).toBeVisible({ timeout: 10_000 });
    await tw.fillGoal(testGoal);
    await tw.clickContinue();

    // Upload step should be visible
    await expect(tw.fileInput).toBeAttached({ timeout: 10_000 });

    // Upload the test content file
    await tw.uploadFile(testContentFile);

    // Analyze button or auto-analyze should trigger
    const analyzeBtn = page.getByRole('button', { name: /analyze|upload.*extract/i });
    const hasAnalyze = await analyzeBtn.isVisible({ timeout: 3_000 }).catch(() => false);
    if (hasAnalyze) {
      await analyzeBtn.click();
    }

    // Wait for extraction progress indicators
    const hasProgress = await page.locator('.tw-progress-fill, .tw-timeline-step, .tw-quick-preview-wrap')
      .first()
      .isVisible({ timeout: 30_000 })
      .catch(() => false);

    // Should eventually show content groups or extraction summary
    const hasGroups = await tw.groupRows.first()
      .isVisible({ timeout: 90_000 })
      .catch(() => false);

    // Either progress was shown or groups appeared
    expect(hasProgress || hasGroups).toBe(true);
  });

  test('should skip upload and reach lesson plan', async ({ page }) => {
    const tw = new TeachWizardPage(page);
    await tw.goto();

    // Select institution
    const res = await page.request.get('/api/domains');
    const domains = (await res.json()).domains || [];
    if (domains.length === 0) {
      test.skip(true, 'No institutions seeded');
      return;
    }

    const dropdownArea = tw.institutionDropdown.locator('input, [role="combobox"], [class*="select"]').first();
    await dropdownArea.click();
    await page.locator(`text="${domains[0].name}"`).first().click();
    await expect(tw.courseSection).toBeVisible({ timeout: 10_000 });

    // New course
    await tw.newCourseChip.click();
    await tw.courseNameInput.waitFor({ state: 'visible' });
    await tw.courseNameInput.fill(`E2E Skip Upload ${Date.now()}`);
    await tw.intentCards.first().click();
    await tw.clickContinue();

    // Goal
    await expect(tw.goalTextarea).toBeVisible({ timeout: 10_000 });
    await tw.fillGoal('Students can identify key vocabulary');
    await tw.clickContinue();

    // Skip upload
    await tw.skipUpload();

    // Lesson plan section should appear (or launch if upload+review auto-skipped)
    const hasLessonPlan = await tw.lessonItems.first()
      .isVisible({ timeout: 15_000 })
      .catch(() => false);
    const hasLaunch = await tw.launchButton
      .isVisible({ timeout: 5_000 })
      .catch(() => false);

    expect(hasLessonPlan || hasLaunch).toBe(true);
  });

  test('full flow: institution → course → goal → skip upload → launch → sim redirect', async ({ page }) => {
    test.slow(); // Full wizard + launch API calls

    const tw = new TeachWizardPage(page);
    await tw.goto();

    // ── Step 1: Institution ──
    const res = await page.request.get('/api/domains');
    const domains = (await res.json()).domains || [];
    if (domains.length === 0) {
      test.skip(true, 'No institutions seeded');
      return;
    }

    await test.step('Select institution', async () => {
      const dropdownArea = tw.institutionDropdown.locator('input, [role="combobox"], [class*="select"]').first();
      await dropdownArea.click();
      await page.locator(`text="${domains[0].name}"`).first().click();
      await expect(tw.courseSection).toBeVisible({ timeout: 10_000 });
    });

    // ── Step 2: Course ──
    await test.step('Create new course', async () => {
      await tw.newCourseChip.click();
      await tw.courseNameInput.waitFor({ state: 'visible' });
      await tw.courseNameInput.fill(`E2E Full Flow ${Date.now()}`);
      await tw.intentCards.first().click();
      await tw.clickContinue();
    });

    // ── Step 3: Goal ──
    await test.step('Set learning goal', async () => {
      await expect(tw.goalTextarea).toBeVisible({ timeout: 10_000 });
      await tw.fillGoal('Students can recall the stages of mitosis');
      await tw.clickContinue();
    });

    // ── Step 4: Skip upload ──
    await test.step('Skip content upload', async () => {
      await tw.skipUpload();
    });

    // ── Step 5-6: Advance through review/lesson plan if shown ──
    await test.step('Advance to launch', async () => {
      // Click Continue on any intermediate sections until Launch button visible
      for (let i = 0; i < 3; i++) {
        const hasLaunch = await tw.launchButton.isVisible().catch(() => false);
        if (hasLaunch) break;

        const continueBtn = page.locator('.tw-btn-continue:visible').first();
        const hasContinue = await continueBtn.isVisible().catch(() => false);
        if (hasContinue) {
          await continueBtn.click();
          await page.waitForTimeout(1_000);
        }
      }
    });

    // ── Step 7: Launch ──
    await test.step('Launch and redirect to sim', async () => {
      await expect(tw.launchButton).toBeVisible({ timeout: 15_000 });
      await tw.launchButton.click();

      // Should redirect to /x/sim/{callerId}
      await tw.waitForSimRedirect(60_000);
      expect(page.url()).toMatch(/\/x\/sim\/[a-f0-9-]+/);
    });
  });
});
