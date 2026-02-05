/**
 * Seed learner profile specs
 */
import { seedFromSpecs } from "./prisma/seed-from-specs";

async function main() {
  console.log("Seeding learner profile specs...\n");

  const results = await seedFromSpecs();

  console.log("\n=== SEEDED SPECS ===");
  results.forEach(r => {
    if (r.specId.includes("LEARN") || r.specId.includes("ADAPT")) {
      console.log(`✓ ${r.specId}: ${r.title}`);
      console.log(`  Parameters: ${r.parametersCreated} created, ${r.parametersUpdated} updated`);
    }
  });

  const learnerSpecs = results.filter(r =>
    r.specId.includes("LEARN") || r.specId.includes("ADAPT")
  );

  console.log(`\n Total learner-related specs: ${learnerSpecs.length}`);
  console.log(`Total all specs: ${results.length}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
