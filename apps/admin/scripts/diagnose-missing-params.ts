/**
 * Diagnose why parameters weren't created for MEASURE_AGENT specs
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function diagnose() {
  // 1. Check the 3 problematic specs
  const specs = await prisma.analysisSpec.findMany({
    where: {
      slug: { in: ["spec-style-001", "spec-comp-insight-001", "spec-supv-001"] },
    },
    select: {
      slug: true,
      name: true,
      outputType: true,
      specRole: true,
      createdAt: true,
      sourceFeatureSetId: true,
      triggers: {
        include: {
          actions: {
            select: {
              parameterId: true,
            },
          },
        },
      },
    },
  });

  console.log("=== Diagnosis: Missing Parameters ===\n");

  for (const spec of specs) {
    console.log(`${spec.slug}: ${spec.name}`);
    console.log(`  Output Type: ${spec.outputType}`);
    console.log(`  Spec Role: ${spec.specRole}`);
    console.log(`  Created: ${spec.createdAt.toISOString()}`);

    // Extract parameter IDs from triggers/actions
    const referencedParamIds = new Set<string>();
    spec.triggers.forEach((trigger) => {
      trigger.actions.forEach((action) => {
        if (action.parameterId) {
          referencedParamIds.add(action.parameterId);
        }
      });
    });

    console.log(`  Referenced Parameters: ${referencedParamIds.size}`);
    console.log(
      `    ${Array.from(referencedParamIds).join(", ")}`
    );

    // Check if parameters exist
    const existingParams = await prisma.parameter.findMany({
      where: {
        parameterId: { in: Array.from(referencedParamIds) },
      },
      select: { parameterId: true },
    });

    const existingIds = new Set(existingParams.map((p) => p.parameterId));
    const missingIds = Array.from(referencedParamIds).filter(
      (id) => !existingIds.has(id)
    );

    console.log(`  Existing in DB: ${existingParams.length}`);
    console.log(`  Missing from DB: ${missingIds.length}`);
    if (missingIds.length > 0) {
      console.log(`    ${missingIds.join(", ")}`);
    }

    // Check if spec has sourceFeatureSet
    if (spec.sourceFeatureSetId) {
      const featureSet = await prisma.bDDFeatureSet.findUnique({
        where: { id: spec.sourceFeatureSetId },
        select: { featureId: true, parameters: true },
      });
      const compiledParams = (featureSet?.parameters as any[]) || [];
      console.log(
        `  Parameters in sourceFeatureSet JSON: ${compiledParams.length}`
      );
    }

    console.log("");
  }

  // 2. Summary
  console.log("=== Root Cause Analysis ===");
  console.log(
    "The specs exist with triggers/actions referencing parameters,"
  );
  console.log("but Parameter records were never created in the database.");
  console.log("");
  console.log("Possible causes:");
  console.log(
    "1. Specs were seeded BEFORE the parameter creation logic was added"
  );
  console.log(
    "2. Specs were created manually without going through seed/activate flow"
  );
  console.log(
    "3. Parameter creation logic had a bug that skipped MEASURE_AGENT specs"
  );
  console.log(
    "4. Specs were activated but parameter creation failed silently"
  );

  await prisma.$disconnect();
}

diagnose().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
