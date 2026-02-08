/**
 * CLEAN SEED - Single Source of Truth
 *
 * This seed script follows the principle: ALL DATA FROM FILES, NOTHING HARDCODED.
 *
 * Data sources:
 * 1. bdd-specs/*.spec.json  → Parameters, Specs, Anchors, Slugs
 * 2. transcripts/           → Real caller/call data from VAPI exports
 *
 * Usage:
 *   npx tsx prisma/seed-clean.ts
 *   npx tsx prisma/seed-clean.ts --reset    # Clear DB first
 *
 * NO fabricated callers. NO inline specs. NO mock data.
 */

import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "@prisma/client";
import { seedFromSpecs, loadSpecFiles } from "./seed-from-specs";

const prisma = new PrismaClient();

// =============================================================================
// CONFIGURATION
// =============================================================================

const TRANSCRIPTS_DIR = path.join(__dirname, "../transcripts");
const BDD_SPECS_DIR = path.join(__dirname, "../bdd-specs");

// =============================================================================
// CLEAR DATABASE (optional)
// =============================================================================

async function clearDatabase() {
  console.log("\n🗑️  CLEARING DATABASE\n");

  // Clear in FK-safe order
  const tables = [
    "callerAttribute",
    "callerTarget",
    "callTarget",
    "rewardScore",
    "behaviorMeasurement",
    "callScore",
    "composedPrompt",
    "call",
    "callerMemorySummary",
    "callerMemory",
    "personalityObservation",
    "callerPersonalityProfile",
    "callerPersonality",
    "promptSlugSelection",
    "callerIdentity",
    "caller",
    "behaviorTarget",
    "playbookSpec",
    "playbookItem",
    "curriculumModule",
    "curriculum",
    "playbook",
    "domain",
    "analysisAction",
    "analysisTrigger",
    "analysisSpec",
    "bDDUpload",
    "bDDFeatureSet",
    "promptSlugRange",
    "promptSlugParameter",
    "promptSlug",
    "promptBlock",
    "promptTemplate",
    "parameterScoringAnchor",
    "parameter",
  ];

  for (const table of tables) {
    try {
      // @ts-ignore
      const count = await prisma[table].count();
      if (count > 0) {
        // @ts-ignore
        await prisma[table].deleteMany();
        console.log(`   ✓ ${table}: ${count} rows cleared`);
      }
    } catch {
      // Table might not exist
    }
  }

  console.log("\n   ✅ Database cleared\n");
}

// =============================================================================
// LOAD BDD SPECS
// =============================================================================

async function loadSpecs() {
  console.log("\n📋 LOADING BDD SPECS\n");
  console.log(`   Source: ${BDD_SPECS_DIR}`);

  const specFiles = loadSpecFiles();
  console.log(`   Found: ${specFiles.length} spec files\n`);

  if (specFiles.length === 0) {
    console.log("   ⚠️  No spec files found. Add .spec.json files to bdd-specs/\n");
    return;
  }

  // List what we're loading
  for (const { filename } of specFiles) {
    console.log(`   • ${filename}`);
  }

  console.log("\n   Activating specs...\n");

  const results = await seedFromSpecs();

  console.log("\n   ✅ Specs loaded and activated\n");
  console.log(`      Parameters: ${results.reduce((sum, r) => sum + r.parametersCreated, 0)} created`);
  console.log(`      Specs: ${results.reduce((sum, r) => sum + r.specsCreated, 0)} created`);
  console.log(`      Anchors: ${results.reduce((sum, r) => sum + r.anchorsCreated, 0)} created`);
  console.log(`      Slugs: ${results.reduce((sum, r) => sum + r.promptSlugsCreated, 0)} created`);
}

// =============================================================================
// LOAD TRANSCRIPTS
// =============================================================================

interface VAPICall {
  id: string;
  transcript: string;
  summary?: string;
  customer?: { name?: string; number?: string } | null;
  startedAt?: string | null;
  endedAt?: string | null;
  status?: string;
  messages?: Array<{ role: string; message: string; time?: number }>;
  createdAt?: string;
}

async function loadTranscripts() {
  console.log("\n📞 LOADING TRANSCRIPTS\n");
  console.log(`   Source: ${TRANSCRIPTS_DIR}`);

  if (!fs.existsSync(TRANSCRIPTS_DIR)) {
    console.log("   ⚠️  Transcripts directory not found. Skipping.\n");
    return;
  }

  // Get first available domain (must exist - run seed-domains.ts first)
  const domain = await prisma.domain.findFirst();
  if (!domain) {
    console.log("   ⚠️  No domain found. Run seed-domains.ts first to create domains.");
    console.log("   Skipping transcript import.\n");
    return;
  }
  console.log(`   Using domain: ${domain.name} (${domain.slug})\n`);

  // Find all JSON/TXT files
  const files = fs.readdirSync(TRANSCRIPTS_DIR).filter(
    (f) => f.endsWith(".json") || f.endsWith(".txt")
  );

  console.log(`   Found: ${files.length} transcript files\n`);

  let callersCreated = 0;
  let callsCreated = 0;
  const callersByPhone = new Map<string, string>(); // phone -> callerId

  for (const filename of files) {
    const filePath = path.join(TRANSCRIPTS_DIR, filename);
    const content = fs.readFileSync(filePath, "utf-8");

    try {
      let calls: VAPICall[] = [];

      if (filename.endsWith(".json")) {
        const data = JSON.parse(content);
        calls = Array.isArray(data) ? data : [data];
      } else if (filename.endsWith(".txt")) {
        // Parse text transcript format
        const call = parseTextTranscript(content, filename);
        if (call) calls = [call];
      }

      for (const call of calls) {
        if (!call.transcript || call.transcript.trim().length < 50) continue;

        // Get or create caller
        const phone = typeof call.customer === "object"
          ? call.customer?.number || "unknown"
          : call.customer || "unknown";

        let callerId = callersByPhone.get(phone);
        if (!callerId) {
          const caller = await prisma.caller.create({
            data: {
              name: typeof call.customer === "object"
                ? call.customer?.name || `Caller ${phone.slice(-4)}`
                : `Caller ${phone.slice(-4)}`,
              phone,
              domainId: domain.id,
            },
          });
          callerId = caller.id;
          callersByPhone.set(phone, callerId);
          callersCreated++;
        }

        // Create call
        await prisma.call.create({
          data: {
            source: "vapi-import",
            externalId: call.id || `import-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            callerId,
            transcript: call.transcript,
            // Note: startedAt/endedAt removed - not in current schema
          },
        });
        callsCreated++;
      }
    } catch (e: any) {
      console.log(`   ⚠️  Error processing ${filename}: ${e.message}`);
    }
  }

  console.log(`   ✅ Imported ${callsCreated} calls from ${callersCreated} callers\n`);
}

function parseTextTranscript(content: string, filename: string): VAPICall | null {
  try {
    const lines = content.split("\n");
    let transcript = "";
    let phone = "unknown";
    let inTranscript = false;

    for (const line of lines) {
      if (line.startsWith("Phone Number:")) {
        phone = line.replace("Phone Number:", "").trim();
      } else if (line.trim() === "Transcript") {
        inTranscript = true;
      } else if (inTranscript && line.trim()) {
        transcript += line + "\n";
      }
    }

    if (!transcript.trim()) return null;

    const idMatch = filename.match(/log_([a-f0-9-]+)/i);
    return {
      id: idMatch?.[1] || filename.replace(/\.[^.]+$/, ""),
      transcript: transcript.trim(),
      customer: { number: phone },
    };
  } catch {
    return null;
  }
}

// =============================================================================
// CREATE MINIMAL INFRASTRUCTURE
// =============================================================================

async function createInfrastructure() {
  console.log("\n🏗️  CREATING INFRASTRUCTURE\n");

  // NOTE: Default domain and playbook creation removed
  // Use seed-domains.ts and BDD-based seeding for proper domain/playbook setup
  console.log("   ℹ️  Skipping default domain/playbook creation");
  console.log("   → Use seed-domains.ts for proper domain setup");
  console.log("   → Use BDD specs for playbook creation");

  console.log("\n   ✅ Infrastructure ready\n");
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  const args = process.argv.slice(2);
  const shouldReset = args.includes("--reset") || args.includes("-r");

  console.log("\n" + "═".repeat(60));
  console.log("  🌱 CLEAN SEED - Single Source of Truth");
  console.log("═".repeat(60));
  console.log("\n  Data Sources:");
  console.log("  • bdd-specs/*.spec.json  → Specs, Parameters, Anchors");
  console.log("  • transcripts/           → Real caller/call data");
  console.log("\n  NO hardcoded data. NO mock callers. NO inline specs.\n");

  if (shouldReset) {
    await clearDatabase();
  }

  // 1. Load all BDD specs
  await loadSpecs();

  // 2. Create minimal infrastructure (domain, playbook)
  await createInfrastructure();

  // 3. Load real transcripts
  await loadTranscripts();

  // Summary
  const specCount = await prisma.analysisSpec.count();
  const paramCount = await prisma.parameter.count();
  const callerCount = await prisma.caller.count();
  const callCount = await prisma.call.count();

  console.log("\n" + "═".repeat(60));
  console.log("  ✅ SEED COMPLETE");
  console.log("═".repeat(60));
  console.log(`\n  Specs:      ${specCount}`);
  console.log(`  Parameters: ${paramCount}`);
  console.log(`  Callers:    ${callerCount}`);
  console.log(`  Calls:      ${callCount}`);
  console.log("\n  Next: Go to /x/studio to configure playbooks and generate prompts\n");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
