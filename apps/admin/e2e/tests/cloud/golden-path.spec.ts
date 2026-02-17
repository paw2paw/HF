import path from 'path';
import { test, expect } from '../../fixtures';
import { QuickLaunchPage, SimPage } from '../../page-objects';

/**
 * Golden Path — The Product Value Loop
 *
 * Upload content → AI builds curriculum → Prompt 0 → Call → Pipeline → Prompt 1
 *
 * This single test proves the entire product works end-to-end:
 * the system learns from a conversation and adapts the next prompt.
 *
 * Requires: AI API keys configured, seeded DB.
 * Cost: ~$0.10-0.30 per run (multiple AI round-trips).
 */
test.describe('Golden Path — Upload → Call → Prompt Evolution', () => {
  const suffix = Date.now();
  const agentName = `E2E Golden ${suffix}`;
  const testContentPath = path.join(__dirname, '../../fixtures/test-content.txt');

  // Shared state across steps
  let callerId: string;
  let prompt0: any;

  // Cloud project uses storageState from global setup — already authenticated

  test('upload content → call → prompt evolves', async ({ page }) => {
    test.slow(); // Multiple AI calls — 3x timeout

    // ─── Step 1: Quick Launch with uploaded content ─────
    await test.step('Quick Launch: upload content and create domain', async () => {
      const ql = new QuickLaunchPage(page);
      await ql.goto();

      // Dismiss stale in-progress launch from previous runs
      await ql.dismissResumePrompt();

      // Fill form with timestamp-unique name
      await ql.fillForm(
        `E2E Golden Path ${suffix} — teaching photosynthesis`,
        agentName,
      );

      // Switch to upload mode and attach file
      await ql.selectUploadMode();
      await ql.uploadFile(testContentPath);

      // Verify file appears in the UI
      await expect(page.getByText('test-content.txt')).toBeVisible({ timeout: 5_000 });

      // Wait for persona to auto-select
      await page.waitForTimeout(1_000);

      // Build → Review → Create → Result
      await ql.clickBuild();
      await ql.waitForReviewPhase(90_000);
      await ql.waitForCreateEnabled(60_000);
      await ql.clickCreate();
      await ql.waitForResult(120_000);

      // Verify result
      await expect(page.getByText('Ready to test')).toBeVisible();
      await expect(ql.viewCallerButton).toBeVisible();
    });

    // ─── Step 2: Extract callerId from result ───────────
    await test.step('Extract callerId from result page', async () => {
      const ql = new QuickLaunchPage(page);
      callerId = await ql.navigateToTestCaller();
      expect(callerId).toMatch(/^[a-f0-9-]+$/);
    });

    // ─── Step 3: Open Sim — Prompt 0 composed ───────────
    await test.step('Open Sim — AI greets, Prompt 0 created', async () => {
      const sim = new SimPage(page, callerId);
      await sim.goto();

      // SimChat init: compose-prompt → create call → AI greeting
      await sim.waitForGreeting(60_000);
      const msgCount = await sim.getMessageCount();
      expect(msgCount).toBeGreaterThanOrEqual(1);

      // Fetch Prompt 0 via API
      const res = await page.request.get(
        `/api/callers/${callerId}/compose-prompt?status=all&limit=10`,
      );
      expect(res.ok()).toBeTruthy();
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.prompts.length).toBeGreaterThanOrEqual(1);

      // Prompt 0 = the sim-triggered prompt
      prompt0 = data.prompts.find((p: any) => p.triggerType === 'sim');
      expect(prompt0).toBeTruthy();
      expect(prompt0.status).toBe('active');

      // Brand-new caller: no memories from prior calls
      const inputs = prompt0.inputs as Record<string, any>;
      expect(inputs.memoriesCount).toBe(0);
    });

    // ─── Step 4: Have a conversation ─────────────────────
    await test.step('Conduct a sim conversation', async () => {
      const sim = new SimPage(page, callerId);

      // Send substantive messages the pipeline can extract from
      await sim.sendMessage(
        'Can you explain how the light-dependent reactions work in photosynthesis?',
      );
      await sim.waitForResponse(45_000);

      await sim.sendMessage(
        'That makes sense. I prefer visual explanations — diagrams really help me learn. '
        + 'What about the Calvin cycle?',
      );
      await sim.waitForResponse(45_000);

      // greeting + 2 user messages + 2 AI responses = 5+
      const count = await sim.getMessageCount();
      expect(count).toBeGreaterThanOrEqual(5);
    });

    // ─── Step 5: End call with pipeline ──────────────────
    await test.step('End call with pipeline enabled', async () => {
      const sim = new SimPage(page, callerId);

      await sim.endCall(true);

      const toastText = await sim.waitForToast(30_000);
      expect(toastText).toMatch(/saved|analysis/i);
    });

    // ─── Step 6: Wait for pipeline → Prompt 1 ───────────
    await test.step('Wait for pipeline to create Prompt 1', async () => {
      const maxWaitMs = 90_000;
      const pollIntervalMs = 5_000;
      const startTime = Date.now();
      let found = false;

      while (Date.now() - startTime < maxWaitMs) {
        const res = await page.request.get(
          `/api/callers/${callerId}/compose-prompt?status=all&limit=10`,
        );
        if (res.ok()) {
          const data = await res.json();
          if (data.ok && data.prompts?.some((p: any) => p.triggerType === 'pipeline')) {
            found = true;
            break;
          }
        }
        await page.waitForTimeout(pollIntervalMs);
      }

      expect(found).toBe(true);
    });

    // ─── Step 7: Compare Prompt 0 vs Prompt 1 ───────────
    await test.step('Verify Prompt 1 evolved from Prompt 0', async () => {
      const res = await page.request.get(
        `/api/callers/${callerId}/compose-prompt?status=all&limit=10`,
      );
      const data = await res.json();

      const p1 = data.prompts.find((p: any) => p.triggerType === 'pipeline');
      const p0 = data.prompts.find((p: any) => p.triggerType === 'sim');
      const p1Inputs = p1.inputs as Record<string, any>;

      // Pipeline extracted memories from the conversation
      expect(p1Inputs.memoriesCount).toBeGreaterThan(0);

      // Pipeline built a personality profile
      expect(p1Inputs.personalityAvailable).toBe(true);

      // Prompt 0 was superseded by Prompt 1
      expect(p0.status).toBe('superseded');

      // Prompt 1 has real content
      expect(p1.prompt.length).toBeGreaterThan(100);
      expect(p1.status).toBe('active');
    });
  });
});
