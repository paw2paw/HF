/**
 * Slice 1 functional test — drives persist → read → gate against real DB.
 * Run: npx tsx scripts/test-slice1-functional.ts
 */
import { prisma } from "@/lib/prisma";
import {
  persistSchedulerDecision,
  readSchedulerDecision,
  SCHEDULER_DECISION_KEY,
} from "@/lib/pipeline/scheduler-decision";
import { shouldRunCallerAnalysis } from "@/lib/pipeline/event-gate";
import { config } from "@/lib/config";

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

let failures = 0;
function expect(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    console.log(`  ${GREEN}✓${RESET} ${label} ${DIM}→ ${JSON.stringify(actual)}${RESET}`);
  } else {
    console.log(`  ${RED}✗${RESET} ${label}`);
    console.log(`    expected: ${JSON.stringify(expected)}`);
    console.log(`    actual:   ${JSON.stringify(actual)}`);
    failures++;
  }
}

async function main() {
  console.log("\n=== Slice 1 functional test ===\n");
  console.log(`config.scheduler.placeholderMode = ${config.scheduler.placeholderMode}`);
  console.log(`config.scheduler.assessmentModes = ${JSON.stringify(config.scheduler.assessmentModes)}\n`);

  const caller = await prisma.caller.findFirst({
    where: { domainId: { not: null } },
    select: { id: true, name: true, domainId: true },
  });
  if (!caller) {
    console.log(`${RED}No caller with domainId found — run seed first${RESET}`);
    process.exit(1);
  }
  console.log(`Using caller: ${caller.name || caller.id} (${caller.id})\n`);

  // Cleanup: remove any existing decision so the test starts from zero
  await prisma.callerAttribute.deleteMany({
    where: { callerId: caller.id, key: SCHEDULER_DECISION_KEY },
  });

  console.log("1. No prior decision → gate allows:");
  const g1 = await shouldRunCallerAnalysis(caller.id);
  expect("allow", g1.allow, true);
  expect("mode", g1.mode, "unknown");

  console.log("\n2. Persist placeholder (mode=teach) → gate denies:");
  await persistSchedulerDecision(caller.id, {
    mode: "teach",
    outcomeId: null,
    contentSourceId: null,
    workingSetAssertionIds: ["tp1", "tp2"],
    reason: "functional-test placeholder",
  });
  const stored = await readSchedulerDecision(caller.id);
  expect("stored.mode", stored?.mode, "teach");
  expect("stored.workingSetAssertionIds", stored?.workingSetAssertionIds, ["tp1", "tp2"]);
  const g2 = await shouldRunCallerAnalysis(caller.id);
  expect("allow", g2.allow, false);
  expect("mode", g2.mode, "teach");

  console.log("\n3. Update to mode=assess → gate allows:");
  await persistSchedulerDecision(caller.id, {
    mode: "assess",
    outcomeId: "lo-cfa-01",
    contentSourceId: null,
    workingSetAssertionIds: ["tp1"],
    reason: "functional-test assess",
  });
  const g3 = await shouldRunCallerAnalysis(caller.id);
  expect("allow", g3.allow, true);
  expect("mode", g3.mode, "assess");

  console.log("\n4. Update to mode=practice → gate allows:");
  await persistSchedulerDecision(caller.id, {
    mode: "practice",
    outcomeId: null,
    contentSourceId: null,
    workingSetAssertionIds: [],
    reason: "functional-test practice",
  });
  const g4 = await shouldRunCallerAnalysis(caller.id);
  expect("allow", g4.allow, true);

  console.log("\n5. Update to mode=review → gate denies:");
  await persistSchedulerDecision(caller.id, {
    mode: "review",
    outcomeId: null,
    contentSourceId: null,
    workingSetAssertionIds: [],
    reason: "functional-test review",
  });
  const g5 = await shouldRunCallerAnalysis(caller.id);
  expect("allow", g5.allow, false);

  console.log("\n6. Upsert round-trip preserves writtenAt freshness:");
  const before = (await readSchedulerDecision(caller.id))!.writtenAt;
  await new Promise((r) => setTimeout(r, 20));
  await persistSchedulerDecision(caller.id, {
    mode: "teach",
    outcomeId: null,
    contentSourceId: null,
    workingSetAssertionIds: [],
    reason: "round-trip",
  });
  const after = (await readSchedulerDecision(caller.id))!.writtenAt;
  expect("writtenAt advanced", after > before, true);

  // Cleanup
  await prisma.callerAttribute.deleteMany({
    where: { callerId: caller.id, key: SCHEDULER_DECISION_KEY },
  });
  console.log(`\n${DIM}Cleaned up test attributes${RESET}`);

  console.log(`\n${failures === 0 ? GREEN + "✓ ALL PASSED" : RED + `✗ ${failures} FAILED`}${RESET}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
