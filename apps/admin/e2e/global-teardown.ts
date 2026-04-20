/**
 * Global Teardown — cleans up e2e-created data after test runs.
 *
 * Deletes DB rows whose names match e2e patterns (E2E *, e2e-*).
 * Runs after all tests complete. Safe to run repeatedly.
 *
 * Skipped on CI (ephemeral DB) and cloud (uses dedicated e2e seed data).
 */

import { PrismaClient } from "@prisma/client";

const E2E_NAME_PATTERNS = ["E2E %", "e2e-%", "e2e_%"];

async function globalTeardown() {
  if (process.env.CI || process.env.CLOUD_E2E) return;

  const prisma = new PrismaClient();

  try {
    console.log("[Global Teardown] Cleaning up e2e test data...");

    // Order matters — delete children before parents to avoid FK violations.
    // Playbooks (courses created via teach wizard / quick launch)
    const playbooks = await prisma.playbook.deleteMany({
      where: {
        OR: E2E_NAME_PATTERNS.map((p) => ({ name: { startsWith: p.replace(" %", " ").replace("%", "") } })),
      },
    });

    // Domains (communities created via quick launch)
    const domains = await prisma.domain.deleteMany({
      where: {
        AND: [
          { kind: "COMMUNITY" },
          {
            OR: E2E_NAME_PATTERNS.map((p) => ({ name: { startsWith: p.replace(" %", " ").replace("%", "") } })),
          },
        ],
      },
    });

    // Classrooms created by educator wizard tests
    const classrooms = await prisma.cohortGroup.deleteMany({
      where: { name: { startsWith: "E2E " } },
    });

    console.log(
      `[Global Teardown] Deleted: ${playbooks.count} playbook(s), ${domains.count} domain(s), ${classrooms.count} classroom(s)`,
    );
  } catch (error) {
    // Non-fatal — don't fail the test run because cleanup failed
    console.warn("[Global Teardown] Cleanup failed (non-fatal):", error);
  } finally {
    await prisma.$disconnect();
  }
}

export default globalTeardown;
