import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const specs = await prisma.analysisSpec.findMany({
    where: { isActive: true },
    select: {
      id: true,
      slug: true,
      name: true,
      outputType: true,
      domain: true,
      promptTemplate: true,
      _count: { select: { triggers: true } }
    },
    orderBy: { slug: 'asc' }
  });
  
  console.log('=== Active Specs Analysis ===\n');
  
  const incomplete: any[] = [];
  for (const spec of specs) {
    const hasPT = !!spec.promptTemplate;
    const hasTriggers = spec._count.triggers > 0;
    
    const needsTriggers = ['MEASURE', 'LEARN', 'ADAPT', 'MEASURE_AGENT'].includes(spec.outputType);
    
    let anchorCount = 0;
    if (spec.outputType === 'MEASURE' || spec.outputType === 'MEASURE_AGENT') {
      const actions = await prisma.analysisAction.findMany({
        where: { trigger: { specId: spec.id } },
        select: { parameterId: true }
      });
      const paramIds = actions.map(a => a.parameterId).filter(Boolean) as string[];
      if (paramIds.length > 0) {
        anchorCount = await prisma.parameterScoringAnchor.count({
          where: { parameterId: { in: paramIds } }
        });
      }
    }
    
    const issues: string[] = [];
    if (needsTriggers && !hasTriggers) issues.push('NO TRIGGERS');
    if ((spec.outputType === 'MEASURE' || spec.outputType === 'MEASURE_AGENT') && anchorCount === 0) {
      issues.push('NO ANCHORS');
    }
    if (!hasPT && spec.outputType === 'COMPOSE') issues.push('NO PROMPT TEMPLATE');
    
    if (issues.length > 0) {
      incomplete.push({
        slug: spec.slug,
        name: spec.name,
        outputType: spec.outputType,
        domain: spec.domain,
        triggers: spec._count.triggers,
        anchors: anchorCount,
        issues: issues.join(', ')
      });
    }
  }
  
  console.log('=== INCOMPLETE SPECS ===\n');
  for (const s of incomplete) {
    console.log(`[${s.outputType}] ${s.slug}`);
    console.log(`   Name: ${s.name}`);
    console.log(`   Domain: ${s.domain}`);
    console.log(`   Triggers: ${s.triggers}, Anchors: ${s.anchors}`);
    console.log(`   Issues: ${s.issues}`);
    console.log('');
  }
  
  console.log(`\nTotal incomplete: ${incomplete.length}`);
}
main().finally(() => prisma.$disconnect());
