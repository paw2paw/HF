import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // The system-llm-config is really a CONFIG spec, not MEASURE
  // It doesn't produce scores, it just stores configuration
  // Let's deactivate it as it's misclassified
  await prisma.analysisSpec.update({
    where: { slug: 'system-llm-config' },
    data: { isActive: false }
  });
  console.log('Deactivated system-llm-config (misclassified as MEASURE, actually CONFIG)');
}

main().finally(() => prisma.$disconnect());
