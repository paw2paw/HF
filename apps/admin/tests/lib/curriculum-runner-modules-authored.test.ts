/**
 * #469 — curriculum-runner.ts modulesAuthored guard.
 *
 * When the playbook attached to the subject declares
 * `Playbook.config.modulesAuthored === true`, the runner must NOT call
 * the LLM curriculum generator. The wizard's applyProjection() path
 * (via syncAuthoredModulesToCurriculum) is the correct write path for
 * authored catalogues; running the LLM here would produce spurious
 * topic-frame clusters from QUESTION_BANK assertions instead.
 *
 * Live IELTS wizard run 2026-05-18 produced 11 modules instead of the
 * 4 authored modules because this guard was missing.
 *
 * This file is named distinctly from `curriculum-runner.test.ts` (which
 * is in the vitest test-debt exclude list at vitest.config.ts:50).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  subject: { findUnique: vi.fn() },
  subjectSource: { findMany: vi.fn() },
  contentAssertion: { findMany: vi.fn() },
  playbookSubject: { findFirst: vi.fn() },
  userTask: { update: vi.fn() },
}));

const mockStartTaskTracking = vi.hoisted(() => vi.fn().mockResolvedValue("task-469"));
const mockUpdateTaskProgress = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockCompleteTask = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockFailTask = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockExtractCurriculum = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
  db: (tx?: unknown) => tx ?? mockPrisma,
}));

vi.mock("@/lib/ai/task-guidance", () => ({
  startTaskTracking: (...args: unknown[]) => mockStartTaskTracking(...args),
  updateTaskProgress: (...args: unknown[]) => mockUpdateTaskProgress(...args),
  completeTask: (...args: unknown[]) => mockCompleteTask(...args),
  failTask: (...args: unknown[]) => mockFailTask(...args),
}));

vi.mock("@/lib/content-trust/extract-curriculum", () => ({
  extractCurriculumFromAssertions: (...args: unknown[]) => mockExtractCurriculum(...args),
}));

import { startCurriculumGeneration } from "@/lib/jobs/curriculum-runner";

async function flushMicrotasks() {
  await new Promise((r) => setTimeout(r, 50));
}

function setupAssertionsLoaded() {
  mockPrisma.subject.findUnique.mockResolvedValue({
    id: "sub-1",
    qualificationRef: null,
  });
  mockPrisma.subjectSource.findMany.mockResolvedValue([{ sourceId: "src-1" }]);
  mockPrisma.contentAssertion.findMany.mockResolvedValue([
    { id: "a1", assertion: "Test assertion", category: "fact", chapter: null, section: null, tags: [] },
  ]);
}

describe("curriculum-runner modulesAuthored guard (#469)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExtractCurriculum.mockResolvedValue({ ok: true, modules: [{ title: "M" }], warnings: [] });
  });

  it("skips AI generation when playbook.config.modulesAuthored === true", async () => {
    setupAssertionsLoaded();
    mockPrisma.playbookSubject.findFirst.mockResolvedValue({
      playbookId: "pb-authored",
      playbook: { config: { modulesAuthored: true, subjectDiscipline: "IELTS Speaking" } },
    });

    await startCurriculumGeneration("sub-1", "IELTS Speaking Practice", "user-1");
    await flushMicrotasks();

    expect(mockExtractCurriculum).not.toHaveBeenCalled();
    expect(mockCompleteTask).toHaveBeenCalledWith("task-469");
    expect(mockUpdateTaskProgress).toHaveBeenLastCalledWith("task-469", expect.objectContaining({
      context: expect.objectContaining({
        outputKind: "authored-passthrough",
        persisted: false,
        playbookId: "pb-authored",
      }),
    }));
  });

  it("runs AI generation when modulesAuthored === false", async () => {
    setupAssertionsLoaded();
    mockPrisma.playbookSubject.findFirst.mockResolvedValue({
      playbookId: "pb-1",
      playbook: { config: { modulesAuthored: false } },
    });

    await startCurriculumGeneration("sub-1", "Food Safety L2", "user-1");
    await flushMicrotasks();

    expect(mockExtractCurriculum).toHaveBeenCalled();
  });

  it("runs AI generation when no playbook is linked to subject", async () => {
    setupAssertionsLoaded();
    mockPrisma.playbookSubject.findFirst.mockResolvedValue(null);

    await startCurriculumGeneration("sub-1", "Untitled", "user-1");
    await flushMicrotasks();

    expect(mockExtractCurriculum).toHaveBeenCalled();
  });

  it("runs AI generation when modulesAuthored is undefined (legacy playbooks)", async () => {
    setupAssertionsLoaded();
    mockPrisma.playbookSubject.findFirst.mockResolvedValue({
      playbookId: "pb-legacy",
      playbook: { config: { subjectDiscipline: "Mathematics" } },
    });

    await startCurriculumGeneration("sub-1", "Mathematics", "user-1");
    await flushMicrotasks();

    expect(mockExtractCurriculum).toHaveBeenCalled();
  });
});
