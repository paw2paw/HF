/**
 * Backfill: add the "indicative band label" hard rule to IELTS-Speaking-style
 * course identity overlays.
 *
 * Tester evidence (Boaz, 28 Apr + 29 Apr): every band reference across every
 * test session was delivered as a definitive statement (e.g. "your grammar
 * is now Band 6 level"). The course reference treats the "indicative" label
 * as non-negotiable. This rule appends one hard-constraint to any IDENTITY
 * overlay extending the IELTS Speaking lineage.
 *
 * Idempotent — only inserts the constraint if not already present.
 *
 * Run:
 *   npx tsx scripts/backfill-ielts-indicative-label-rule.ts            # dry-run
 *   npx tsx scripts/backfill-ielts-indicative-label-rule.ts --execute  # apply
 *   npx tsx scripts/backfill-ielts-indicative-label-rule.ts --slug <slug> [--execute]
 *
 * Default match: any AnalysisSpec with specRole=IDENTITY whose slug contains
 * "ielts-speaking" (covers wizard-generated course overlays). Override with
 * --slug to target a single overlay explicitly.
 *
 * @see https://github.com/WANDERCOLTD/HF/issues/215 (parent epic — hard constraints)
 */

import { prisma } from "@/lib/prisma";

const RULE_TEXT =
  "Every IELTS band reference must be labelled \"indicative\" — both spoken and written. " +
  "This rule applies to every utterance in every drill, Baseline, Mock Exam, and casual mention. " +
  "Examples — correct: \"around an indicative Band 6\", \"indicative Band 5 to 6 range\". " +
  "Examples — incorrect: \"that's a Band 6 answer\", \"you're at Band 7 level\". " +
  "The rule does not soften under repeated requests or casual context.";

const RULE_TAG = "indicative band label"; // used for idempotent detection

async function main() {
  const args = process.argv.slice(2);
  const execute = args.includes("--execute");
  const slugIdx = args.indexOf("--slug");
  const explicitSlug = slugIdx >= 0 ? args[slugIdx + 1] : null;
  const dryRun = !execute;

  console.log(
    `\n=== Backfill: IELTS indicative-band-label hard rule ===\n` +
    `  mode: ${dryRun ? "DRY-RUN" : "EXECUTE"}\n` +
    `  filter: ${explicitSlug ? `slug = "${explicitSlug}"` : "slug ILIKE '%ielts-speaking%'"}\n`,
  );

  const candidates = await prisma.analysisSpec.findMany({
    where: {
      specRole: "IDENTITY",
      ...(explicitSlug
        ? { slug: explicitSlug }
        : { slug: { contains: "ielts-speaking", mode: "insensitive" } }),
    },
    select: { id: true, slug: true, name: true, config: true },
  });

  if (candidates.length === 0) {
    console.log("No matching IDENTITY overlays found. Nothing to do.\n");
    return;
  }

  let updated = 0;
  let alreadyPresent = 0;

  for (const spec of candidates) {
    const config = (spec.config as Record<string, unknown> | null) ?? {};
    const constraints = Array.isArray(config.constraints)
      ? (config.constraints as string[])
      : [];

    const hasRule = constraints.some((c) =>
      typeof c === "string" && c.toLowerCase().includes(RULE_TAG),
    );

    if (hasRule) {
      console.log(`  ${spec.slug}: rule already present — skip`);
      alreadyPresent++;
      continue;
    }

    const newConstraints = [...constraints, RULE_TEXT];
    const newConfig = { ...config, constraints: newConstraints };

    if (!dryRun) {
      await prisma.analysisSpec.update({
        where: { id: spec.id },
        data: { config: newConfig as never },
      });
    }
    console.log(
      `  ${spec.slug}: ${dryRun ? "would append" : "appended"} rule (constraints ${constraints.length} → ${newConstraints.length})`,
    );
    updated++;
  }

  console.log(
    `\n=== Summary ===\n` +
    `  Total IDENTITY overlays scanned: ${candidates.length}\n` +
    `  Already had rule (skipped): ${alreadyPresent}\n` +
    `  ${dryRun ? "Would append rule to" : "Appended rule to"}: ${updated}\n`,
  );

  if (dryRun) {
    console.log("Re-run with --execute to apply.\n");
  }
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
