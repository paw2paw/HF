/**
 * Tune IELTS Speaking playbooks for a less verbose tutor voice.
 *
 * Drops BEH_RESPONSE_LEN and BEH_TURN_LENGTH to LOW (0.2) and raises
 * BEH_PAUSE_TOLERANCE to HIGH (0.7). Effect at runtime (see
 * `lib/prompt/composition/transforms/quickstart.ts::critical_voice`):
 *   - sentences_per_turn: 1-2 (down from 2-3)
 *   - max_seconds:       10 (down from 15)
 *   - silence_wait:      "4-5s, don't fill" (instead of "3s then prompt")
 *
 * Match rule: any Playbook whose name contains "IELTS" AND "Speaking"
 * (case-insensitive). Override with --name <substring> to scope more tightly,
 * or --playbook-id <id> to target a single playbook.
 *
 * Run on hf-dev VM (script needs DB access):
 *   npx tsx scripts/tune-ielts-verbosity.ts                       # dry-run
 *   npx tsx scripts/tune-ielts-verbosity.ts --execute             # apply
 *   npx tsx scripts/tune-ielts-verbosity.ts --playbook-id <id> --execute
 *
 * Idempotent: applyBehaviorTargets skips if the existing target is within
 * 0.005 of the new value. Existing active targets are superseded with
 * effectiveUntil=now, preserving history.
 */

import { applyBehaviorTargets } from "@/lib/domain/agent-tuning";
import { prisma } from "@/lib/prisma";
import { PARAMS } from "@/lib/registry";

const TARGETS: Record<string, number> = {
  [PARAMS.BEH_RESPONSE_LEN]: 0.2,
  [PARAMS.BEH_TURN_LENGTH]: 0.2,
  [PARAMS.BEH_PAUSE_TOLERANCE]: 0.7,
};

async function main() {
  const args = process.argv.slice(2);
  const execute = args.includes("--execute");
  const nameIdx = args.indexOf("--name");
  const idIdx = args.indexOf("--playbook-id");
  const nameOverride = nameIdx >= 0 ? args[nameIdx + 1] : null;
  const playbookId = idIdx >= 0 ? args[idIdx + 1] : null;
  const dryRun = !execute;

  console.log(
    `\n=== Tune IELTS Speaking — verbosity (Call 1+) ===\n` +
      `  mode:   ${dryRun ? "DRY-RUN" : "EXECUTE"}\n` +
      `  filter: ${
        playbookId
          ? `playbookId = "${playbookId}"`
          : nameOverride
            ? `name ILIKE '%${nameOverride}%'`
            : `name ILIKE '%ielts%' AND name ILIKE '%speaking%'`
      }\n` +
      `  targets: ${Object.entries(TARGETS)
        .map(([k, v]) => `${k}=${v}`)
        .join(", ")}\n`,
  );

  const playbooks = await prisma.playbook.findMany({
    where: playbookId
      ? { id: playbookId }
      : nameOverride
        ? { name: { contains: nameOverride, mode: "insensitive" } }
        : {
            AND: [
              { name: { contains: "ielts", mode: "insensitive" } },
              { name: { contains: "speaking", mode: "insensitive" } },
            ],
          },
    select: { id: true, name: true, status: true, version: true, domainId: true },
    orderBy: { name: "asc" },
  });

  if (playbooks.length === 0) {
    console.log("No matching playbooks found. Nothing to do.\n");
    return;
  }

  console.log(`Found ${playbooks.length} playbook(s):\n`);
  for (const p of playbooks) {
    console.log(`  - ${p.name}  [${p.status} v${p.version}]  id=${p.id}`);
  }
  console.log("");

  if (dryRun) {
    console.log("Dry-run only. Re-run with --execute to apply.\n");
    return;
  }

  let totalApplied = 0;
  for (const p of playbooks) {
    const applied = await applyBehaviorTargets(p.id, TARGETS);
    console.log(`  applied ${applied} target(s) → ${p.name}`);
    totalApplied += applied;
  }

  console.log(`\nDone. ${totalApplied} target(s) written across ${playbooks.length} playbook(s).\n`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
