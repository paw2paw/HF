import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function check() {
  // Get WNF playbook with items
  const wnf = await prisma.playbook.findFirst({
    where: { name: { contains: "WNF" } },
    include: {
      items: {
        include: { spec: { select: { slug: true, name: true, scope: true, specType: true } } }
      }
    }
  });

  console.log("=== PLAYBOOK ITEMS (domain specs attached to playbook) ===");
  console.log("Count:", wnf?.items.length);
  wnf?.items.forEach(item => {
    if (item.spec) {
      console.log("  ", item.spec.slug, "|", item.spec.name, "| scope:", item.spec.scope, "| specType:", item.spec.specType);
    }
  });

  // Check if any playbook items reference SYSTEM specs
  const systemInPlaybook = wnf?.items.filter(i => i.spec?.scope === "SYSTEM" || i.spec?.specType === "SYSTEM");
  console.log("\n=== SYSTEM SPECS ALSO IN PLAYBOOK ITEMS ===");
  console.log("Count:", systemInPlaybook?.length);
  systemInPlaybook?.forEach(item => {
    console.log("  ⚠️ DUPLICATE:", item.spec?.slug, "|", item.spec?.name);
  });

  await prisma.$disconnect();
}
check();
