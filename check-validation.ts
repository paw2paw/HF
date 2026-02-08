import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function check() {
  // Check for dirty specs
  const dirtySpecs = await prisma.analysisSpec.findMany({
    where: { isDirty: true },
    select: { slug: true, dirtyReason: true }
  });
  
  console.log("=== DIRTY SPECS ===");
  if (dirtySpecs.length === 0) {
    console.log("✅ No dirty specs");
  } else {
    console.log("⚠️ Found", dirtySpecs.length, "dirty specs:");
    dirtySpecs.forEach(s => console.log("  -", s.slug, "|", s.dirtyReason));
  }

  // Check BDDFeatureSet compilation status
  const featureSets = await prisma.bDDFeatureSet.findMany({
    select: { slug: true, compiledAt: true, isActive: true }
  });
  
  console.log("\n=== BDD FEATURE SETS ===");
  featureSets.forEach(fs => {
    const status = fs.compiledAt ? "✅ Compiled" : "⚠️ Not compiled";
    console.log(" ", status, "|", fs.slug, "| active:", fs.isActive);
  });

  // Check playbook validation status
  const playbooks = await prisma.playbook.findMany({
    select: { name: true, status: true, validationPassed: true, publishedAt: true }
  });
  
  console.log("\n=== PLAYBOOKS ===");
  playbooks.forEach(pb => {
    const valid = pb.validationPassed ? "✅" : "⚠️";
    console.log(" ", valid, pb.name, "|", pb.status, "| published:", pb.publishedAt ? "yes" : "no");
  });

  // Check for specs without triggers (might indicate incomplete compilation)
  const specsWithoutTriggers = await prisma.analysisSpec.findMany({
    where: { triggers: { none: {} } },
    select: { slug: true, outputType: true }
  });
  
  console.log("\n=== SPECS WITHOUT TRIGGERS ===");
  if (specsWithoutTriggers.length === 0) {
    console.log("✅ All specs have triggers");
  } else {
    console.log("⚠️ Found", specsWithoutTriggers.length, "specs without triggers:");
    specsWithoutTriggers.forEach(s => console.log("  -", s.slug, "|", s.outputType));
  }

  // Check ADAPT specs have actions with parameterIds
  const adaptSpecs = await prisma.analysisSpec.findMany({
    where: { outputType: "ADAPT" },
    include: {
      triggers: {
        include: {
          actions: { select: { parameterId: true } }
        }
      }
    }
  });
  
  console.log("\n=== ADAPT SPEC WIRING ===");
  adaptSpecs.forEach(spec => {
    const actionsWithParams = spec.triggers.flatMap(t => t.actions).filter(a => a.parameterId);
    const status = actionsWithParams.length > 0 ? "✅" : "❌";
    console.log(" ", status, spec.slug, "| actions with params:", actionsWithParams.length);
  });

  await prisma.$disconnect();
}
check();
