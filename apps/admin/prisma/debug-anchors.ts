import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Check a few specific specs
  const specs = ['system-personality-ocean', 'companion-cognitive-patterns', 'companion-gentle-guidance'];

  for (const slug of specs) {
    const spec = await prisma.analysisSpec.findUnique({
      where: { slug },
      include: {
        triggers: {
          include: {
            actions: {
              select: { parameterId: true, description: true }
            }
          }
        }
      }
    });

    console.log(`\n=== ${slug} ===`);
    console.log('Triggers:', spec?.triggers.length || 0);

    for (const t of spec?.triggers || []) {
      console.log(`  Trigger: ${t.name}`);
      for (const a of t.actions) {
        console.log(`    Action: ${a.description.substring(0, 50)}...`);
        console.log(`      parameterId: ${a.parameterId}`);

        if (a.parameterId) {
          const anchors = await prisma.parameterScoringAnchor.count({
            where: { parameterId: a.parameterId }
          });
          console.log(`      anchors: ${anchors}`);
        }
      }
    }
  }
}

main().finally(() => prisma.$disconnect());
