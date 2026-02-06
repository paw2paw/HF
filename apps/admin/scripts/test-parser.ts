import { prisma } from "../lib/prisma";

async function main() {
  console.log("Cleaning up existing data...");
  await prisma.bDDUpload.deleteMany({});
  await prisma.bDDFeatureSet.deleteMany({});
  console.log("Done! Please re-upload your XML files at /lab/upload");
}

main().catch(console.error).finally(() => prisma.$disconnect());
