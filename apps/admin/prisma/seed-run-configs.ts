import { PrismaClient } from "@prisma/client";

let prisma: PrismaClient;

export async function main(externalPrisma?: PrismaClient) {
  // CompiledAnalysisSet model was removed from the schema.
  // This seed step is now a no-op until run configs are redesigned.
  console.log("Skipped — CompiledAnalysisSet model removed from schema.\n");
}

if (require.main === module) {
  main()
    .then(() => prisma.$disconnect())
    .catch((e) => {
      console.error(e);
      prisma.$disconnect();
      process.exit(1);
    });
}
