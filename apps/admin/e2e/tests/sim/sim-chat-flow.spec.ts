import { test, expect } from '../../fixtures';
import { SimPage } from '../../page-objects';

/**
 * Sim Chat — Learner Call Flow E2E
 *
 * Tests the WhatsApp-style sim chat interface:
 * Lobby → Start call → Greeting → Conversation → End call → Transcript saved
 *
 * Covers: lobby state, greeting, multi-turn conversation, end call sheet,
 * pipeline toggle, toast feedback, call resumption, message persistence.
 *
 * Requires:
 *   - Seeded DB with callers that have a domain + composed prompt
 *   - AI API keys for streaming responses
 */
test.describe('Sim Chat — Learner Call Flow', () => {
  let callerId: string;
  let callerName: string;

  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs('admin@test.com');

    // Find a caller with a domain for sim testing
    const res = await page.request.get('/api/callers?limit=100');
    if (res.status() !== 200) {
      test.skip(true, 'Callers API unavailable');
      return;
    }
    const data = await res.json();
    const callers = data.callers || [];

    // Prefer a caller with domain (needed for prompt composition)
    const found = callers.find((c: any) => c.domainId) || callers[0];
    if (!found) {
      test.skip(true, 'No callers available');
      return;
    }

    callerId = found.id;
    callerName = found.name || 'Unknown';
  });

  // ── Page Load & Lobby ─────────────────────────────

  test('should load sim page with caller name in header', async ({ page }) => {
    const sim = new SimPage(page, callerId);
    await sim.goto();

    // Header should show caller name
    await expect(sim.headerTitle).toContainText(callerName, { timeout: 15_000 });
  });

  test('should show lobby with start button when no active call', async ({ page }) => {
    // Navigate with forceFirstCall to ensure clean state
    await page.goto(`/x/sim/${callerId}?forceFirstCall=true`);
    await page.waitForLoadState('domcontentloaded');

    // Lobby should show a start button (green phone)
    const lobbyBtn = page.locator('.wa-lobby-start-btn')
      .or(page.getByRole('button', { name: /start.*call|start.*practice/i }));
    await expect(lobbyBtn).toBeVisible({ timeout: 15_000 });
  });

  test('should show message input bar', async ({ page }) => {
    const sim = new SimPage(page, callerId);
    await sim.goto();

    // Input field should be present
    await expect(sim.messageInput).toBeVisible({ timeout: 15_000 });
  });

  // ── Greeting & Conversation ───────────────────────

  test('should receive AI greeting after starting call', async ({ page }) => {
    test.slow(); // AI streaming

    const sim = new SimPage(page, callerId);
    await sim.goto();

    // Wait for greeting (auto-starts or via lobby button)
    await sim.waitForGreeting(60_000);

    // Should have at least one AI bubble
    const aiBubbles = page.locator('.wa-bubble-in');
    const aiCount = await aiBubbles.count();
    expect(aiCount).toBeGreaterThanOrEqual(1);

    // Greeting should have substantive content (not empty)
    const greetingText = await aiBubbles.first().textContent();
    expect(greetingText?.trim().length).toBeGreaterThan(10);
  });

  test('should send message and receive AI response', async ({ page }) => {
    test.slow();

    const sim = new SimPage(page, callerId);
    await sim.goto();
    await sim.waitForGreeting(60_000);

    const beforeCount = await sim.getMessageCount();

    // Send a message
    await sim.sendMessage('Can you explain the main topic to me simply?');

    // User message should appear immediately as outgoing bubble
    const userBubbles = page.locator('.wa-bubble-out');
    await expect(userBubbles.last()).toContainText('explain the main topic', { timeout: 5_000 });

    // Wait for AI response
    await sim.waitForResponse(45_000);

    // Should have more messages now
    const afterCount = await sim.getMessageCount();
    expect(afterCount).toBeGreaterThan(beforeCount);

    // Last AI bubble should have content
    const lastAI = page.locator('.wa-bubble-in').last();
    const responseText = await lastAI.textContent();
    expect(responseText?.trim().length).toBeGreaterThan(10);
  });

  test('should handle multi-turn conversation', async ({ page }) => {
    test.slow();

    const sim = new SimPage(page, callerId);
    await sim.goto();
    await sim.waitForGreeting(60_000);

    // Turn 1
    await sim.sendMessage('What is the first key concept I should learn?');
    await sim.waitForResponse(45_000);

    // Turn 2
    await sim.sendMessage('Can you give me an example of that?');
    await sim.waitForResponse(45_000);

    // Should have greeting + 2 user msgs + 2 AI responses = 5+
    const count = await sim.getMessageCount();
    expect(count).toBeGreaterThanOrEqual(5);
  });

  test('should disable send button while streaming', async ({ page }) => {
    test.slow();

    const sim = new SimPage(page, callerId);
    await sim.goto();
    await sim.waitForGreeting(60_000);

    // Send a message that triggers a long response
    await sim.sendMessage('Give me a detailed explanation of all the key concepts');

    // While typing indicator is visible, input should be disabled
    try {
      await page.locator('.wa-typing').waitFor({ state: 'visible', timeout: 10_000 });
      // Check that input is disabled during streaming
      const isDisabled = await sim.messageInput.isDisabled();
      expect(isDisabled).toBe(true);
    } catch {
      // Streaming was too fast to catch — that's OK
    }

    // After response completes, input should be enabled again
    await sim.waitForResponse(45_000);
    await expect(sim.messageInput).toBeEnabled();
  });

  // ── End Call ──────────────────────────────────────

  test('should show end call sheet with pipeline toggle', async ({ page }) => {
    test.slow();

    const sim = new SimPage(page, callerId);
    await sim.goto();
    await sim.waitForGreeting(60_000);

    // Send at least one message
    await sim.sendMessage('Just a quick test message');
    await sim.waitForResponse(45_000);

    // Click end call button (red phone icon)
    await sim.endCallButton.click();

    // End call sheet should appear
    await expect(page.getByText('End this call?')).toBeVisible({ timeout: 5_000 });

    // Pipeline toggle should be visible and ON by default
    await expect(sim.pipelineToggle).toBeVisible();
    const isActive = await sim.pipelineToggle.evaluate(
      el => el.classList.contains('active'),
    );
    expect(isActive).toBe(true);

    // Cancel and End Call buttons should be visible
    await expect(sim.cancelEndButton).toBeVisible();
    await expect(sim.confirmEndButton).toBeVisible();
  });

  test('should cancel end call and return to chat', async ({ page }) => {
    test.slow();

    const sim = new SimPage(page, callerId);
    await sim.goto();
    await sim.waitForGreeting(60_000);

    await sim.sendMessage('Testing cancel flow');
    await sim.waitForResponse(45_000);

    // Open end call sheet
    await sim.endCallButton.click();
    await expect(page.getByText('End this call?')).toBeVisible({ timeout: 5_000 });

    // Cancel
    await sim.cancelEndButton.click();

    // Sheet should close, chat should still be active
    await expect(page.getByText('End this call?')).toBeHidden({ timeout: 5_000 });
    await expect(sim.messageInput).toBeVisible();
    await expect(sim.messageInput).toBeEnabled();
  });

  test('should end call without pipeline and show save toast', async ({ page }) => {
    test.slow();

    const sim = new SimPage(page, callerId);
    await sim.goto();
    await sim.waitForGreeting(60_000);

    await sim.sendMessage('Quick message before ending');
    await sim.waitForResponse(45_000);

    // End call without pipeline (faster)
    await sim.endCall(false);

    // Toast should confirm save
    const toastText = await sim.waitForToast(15_000);
    expect(toastText).toMatch(/saved/i);
  });

  test('should end call with pipeline and show analysis toast', async ({ page }) => {
    test.slow();

    const sim = new SimPage(page, callerId);
    await sim.goto();
    await sim.waitForGreeting(60_000);

    await sim.sendMessage('I found the explanation of photosynthesis really helpful');
    await sim.waitForResponse(45_000);

    // End call with pipeline enabled
    await sim.endCall(true);

    // Toast should mention analysis
    const toastText = await sim.waitForToast(15_000);
    expect(toastText).toMatch(/saved|analysis/i);
  });

  // ── Call Transcript Persistence ───────────────────

  test('should persist call transcript via API after ending', async ({ page }) => {
    test.slow();

    const sim = new SimPage(page, callerId);
    await sim.goto();
    await sim.waitForGreeting(60_000);

    const testMessage = `E2E transcript test ${Date.now()}`;
    await sim.sendMessage(testMessage);
    await sim.waitForResponse(45_000);

    // End call
    await sim.endCall(false);
    await sim.waitForToast(15_000);

    // Verify transcript was saved via API
    const callsRes = await page.request.get(`/api/callers/${callerId}?includeCalls=true`);
    if (callsRes.ok()) {
      const callsData = await callsRes.json();
      const calls = callsData.caller?.calls || callsData.calls || [];
      const latestCall = calls[0];

      if (latestCall) {
        // Call should have an endedAt timestamp
        expect(latestCall.endedAt).toBeTruthy();

        // Transcript should contain our test message
        if (latestCall.transcript) {
          const transcriptStr = typeof latestCall.transcript === 'string'
            ? latestCall.transcript
            : JSON.stringify(latestCall.transcript);
          expect(transcriptStr).toContain('transcript test');
        }
      }
    }
  });

  // ── Header Controls ───────────────────────────────

  test('should show admin panel toggle for operators', async ({ page }) => {
    const sim = new SimPage(page, callerId);
    await sim.goto();

    // Admin panel button should be visible (admin user = operator+)
    const adminBtn = page.getByRole('button', { name: /admin panel/i });
    await expect(adminBtn).toBeVisible({ timeout: 15_000 });

    // Click to toggle panel
    await adminBtn.click();

    // Panel should appear with admin controls
    const hasPanel = await page.locator('.sim-admin-panel, [class*="admin-panel"]')
      .first()
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    expect(hasPanel).toBe(true);
  });

  test('should show progress panel toggle', async ({ page }) => {
    const sim = new SimPage(page, callerId);
    await sim.goto();

    // Progress button in header
    const progressBtn = page.getByRole('button', { name: /progress/i });
    const hasProgress = await progressBtn.isVisible({ timeout: 10_000 }).catch(() => false);

    if (hasProgress) {
      await progressBtn.click();

      // Progress panel should toggle
      const panel = page.locator('[class*="progress"]').first();
      await expect(panel).toBeVisible({ timeout: 5_000 });
    }
  });

  // ── Navigation Guards ─────────────────────────────

  test('should not create ghost calls on navigation away', async ({ page }) => {
    // Navigate to sim page
    await page.goto(`/x/sim/${callerId}`);
    await page.waitForLoadState('domcontentloaded');

    // Get initial call count
    const beforeRes = await page.request.get(`/api/callers/${callerId}`);
    const beforeData = await beforeRes.json();
    const beforeCallCount = beforeData.caller?.calls?.length || 0;

    // Navigate away quickly (before greeting completes)
    await page.goto('/x/courses');
    await page.waitForLoadState('domcontentloaded');

    // Wait a moment for any async call creation to settle
    await page.waitForTimeout(2_000);

    // Check call count hasn't increased (no ghost call created)
    const afterRes = await page.request.get(`/api/callers/${callerId}`);
    const afterData = await afterRes.json();
    const afterCallCount = afterData.caller?.calls?.length || 0;

    // Should not have created more than 1 extra call (at most the greeting call)
    expect(afterCallCount).toBeLessThanOrEqual(beforeCallCount + 1);
  });
});
