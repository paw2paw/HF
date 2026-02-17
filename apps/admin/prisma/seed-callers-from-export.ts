/**
 * Import callers from a dev DB export (caller-export.json).
 * Maps callers to the first available domain in prod.
 * Handles duplicate phone numbers gracefully (skips if already exists).
 *
 * Usage:
 *   npx tsx prisma/seed-callers-from-export.ts
 */

import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface ExportedCaller {
  name: string;
  phone: string | null;
  domainSlug: string | null;
  domainName: string | null;
  calls: Array<{
    source: string;
    externalId: string | null;
    transcript: string;
    createdAt: string;
  }>;
  memories: Array<{
    key: string;
    value: string;
    category: string;
    confidence: number;
    source: string;
    context: string | null;
  }>;
  attributes: Array<{
    key: string;
    scope: string;
    valueType: string;
    stringValue: string | null;
    numberValue: number | null;
    booleanValue: boolean | null;
    jsonValue: any;
    confidence: number;
  }>;
}

async function main() {
  const exportPath = path.join(__dirname, "caller-export.json");
  if (!fs.existsSync(exportPath)) {
    console.error("caller-export.json not found at", exportPath);
    process.exit(1);
  }

  const callers: ExportedCaller[] = JSON.parse(
    fs.readFileSync(exportPath, "utf-8"),
  );
  console.log(`\n📥 IMPORTING ${callers.length} CALLERS\n`);

  // Get the first domain in prod as default target
  const domain = await prisma.domain.findFirst();
  if (!domain) {
    console.error("No domain found in prod DB. Run seed-clean.ts first.");
    process.exit(1);
  }
  console.log(`   Target domain: ${domain.name} (${domain.slug})\n`);

  let callersCreated = 0;
  let callersSkipped = 0;
  let callsCreated = 0;
  let memoriesCreated = 0;
  let attrsCreated = 0;

  for (const exported of callers) {
    // Check if caller already exists by phone
    if (exported.phone) {
      const existing = await prisma.caller.findFirst({
        where: { phone: exported.phone },
      });
      if (existing) {
        console.log(`   ⏭  ${exported.name} (${exported.phone}) — already exists, skipping`);
        callersSkipped++;
        continue;
      }
    }

    // Create caller
    const caller = await prisma.caller.create({
      data: {
        name: exported.name,
        phone: exported.phone,
        domainId: domain.id,
      },
    });
    callersCreated++;

    // Import calls
    for (const call of exported.calls) {
      await prisma.call.create({
        data: {
          source: call.source || "vapi-import",
          externalId:
            call.externalId ||
            `import-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          transcript: call.transcript,
          callerId: caller.id,
        },
      });
      callsCreated++;
    }

    // Import memories
    for (const mem of exported.memories) {
      await prisma.callerMemory.create({
        data: {
          callerId: caller.id,
          key: mem.key,
          value: mem.value,
          category: mem.category as any,
          confidence: mem.confidence,
          source: mem.source as any,
          context: mem.context,
        },
      });
      memoriesCreated++;
    }

    // Import attributes
    for (const attr of exported.attributes) {
      await prisma.callerAttribute.create({
        data: {
          callerId: caller.id,
          key: attr.key,
          scope: attr.scope,
          valueType: attr.valueType,
          stringValue: attr.stringValue,
          numberValue: attr.numberValue,
          booleanValue: attr.booleanValue,
          jsonValue: attr.jsonValue,
          confidence: attr.confidence,
        },
      });
      attrsCreated++;
    }

    console.log(
      `   ✅ ${exported.name} — ${exported.calls.length} calls, ${exported.memories.length} memories, ${exported.attributes.length} attrs`,
    );
  }

  console.log(`\n════════════════════════════════════════`);
  console.log(`  IMPORT COMPLETE`);
  console.log(`  Callers: ${callersCreated} created, ${callersSkipped} skipped`);
  console.log(`  Calls:   ${callsCreated}`);
  console.log(`  Memories: ${memoriesCreated}`);
  console.log(`  Attrs:   ${attrsCreated}`);
  console.log(`════════════════════════════════════════\n`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
