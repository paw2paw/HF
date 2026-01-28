import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const params = await prisma.parameter.findMany({
    select: { parameterId: true, name: true },
    orderBy: { parameterId: 'asc' }
  });
  console.log('All Parameters:');
  params.forEach(p => console.log(`  ${p.parameterId}: ${p.name}`));
  console.log(`\nTotal: ${params.length}`);
}
main().finally(() => prisma.$disconnect());
