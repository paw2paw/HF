import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function check() {
  // Get all playbooks with their items
  const playbooks = await prisma.playbook.findMany({
    include: {
      items: {
        include: { spec: { select: { slug: true, name: true, specType: true } } }
      },
      domain: true
    }
  });

  console.log("=== PLAYBOOKS AND THEIR SPECS ===\n");
  for (const pb of playbooks) {
    console.log("Playbook:", pb.name, "| Domain:", pb.domain?.name || "none");
    console.log("  Items:", pb.items.length);
    pb.items.forEach(item => {
      if (item.spec) {
        console.log("    -", item.spec.slug, "|", item.spec.specType);
      }
    });
    console.log("");
  }

  // Check companion specs specifically
  const companionSpecs = await prisma.analysisSpec.findMany({
    where: { slug: { startsWith: "spec-comp-" } },
    select: { 
      id: true, 
      slug: true, 
      specType: true,
      playbookItems: { select: { playbook: { select: { name: true } } } }
    }
  });

  console.log("=== COMPANION SPECS PLAYBOOK LINKS ===\n");
  for (const spec of companionSpecs) {
    const linked = spec.playbookItems.length > 0 ? "YES" : "NO";
    const playbooks = spec.playbookItems.map(i => i.playbook.name).join(", ") || "none";
    console.log(linked, spec.slug, "|", spec.specType, "| playbooks:", playbooks);
  }

  // Check unlinked DOMAIN specs
  const unlinkedDomain = await prisma.analysisSpec.findMany({
    where: { 
      specType: "DOMAIN",
      playbookItems: { none: {} }
    },
    select: { slug: true, name: true }
  });

  console.log("\n=== DOMAIN SPECS NOT IN ANY PLAYBOOK ===");
  console.log("Count:", unlinkedDomain.length);
  unlinkedDomain.forEach(s => console.log("  -", s.slug));

  await prisma.$disconnect();
}
check();
