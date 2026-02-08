/**
 * Safe Seed - Refresh Specs & Parameters, Import Transcripts
 *
 * Run with: npx tsx prisma/seed-safe.ts
 *
 * This script:
 * 1. Clears ONLY specs, parameters, playbooks, and related config
 * 2. PRESERVES existing caller data (callers, calls, memories, scores, etc.)
 * 3. Re-seeds the system configuration
 * 4. Imports transcripts from raw files (creates callers/calls if needed)
 */

import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

// Transcript folder paths
const TRANSCRIPTS_FOLDERS = [
  "/Volumes/PAWSTAW/Projects/hf_kb/sources/transcripts/raw",
  "/Volumes/PAWSTAW/Projects/hf_kb/sources/transcripts",
  "/Users/paulwander/hf_kb/sources/transcripts",
  process.env.HF_TRANSCRIPTS_PATH,
].filter(Boolean) as string[];

// VAPI Call Export Types
interface VAPICall {
  id: string;
  transcript: string;
  summary?: string;
  customer: { name?: string; number?: string } | null;
  startedAt: string | null;
  endedAt: string | null;
  status?: string;
  createdAt: string;
}

/**
 * Parse a plain text transcript file into a call object
 */
function parseTextTranscript(content: string, filename: string): VAPICall | null {
  try {
    const logIdMatch = filename.match(/Log ID ([0-9a-f-]+)/i);
    const logId = logIdMatch ? logIdMatch[1] : `txt-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const phoneMatch = content.match(/Phone Number:\s*\+?\s*([0-9\s]+)/i);
    const phone = phoneMatch ? phoneMatch[1].replace(/\s/g, "") : null;
    const transcriptStart = content.indexOf("Transcript");
    if (transcriptStart === -1) return null;

    const transcriptContent = content.slice(transcriptStart + "Transcript".length).trim();
    const lines: string[] = [];
    const sections = transcriptContent.split(/\n(?=Assistant|User)/);

    for (const section of sections) {
      const trimmed = section.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith("Assistant")) {
        const text = trimmed.replace(/^Assistant\s*/i, "").replace(/\d+:\d+:\d+\s*(AM|PM)\s*\(\+[\d.:]+\)/gi, "").trim();
        if (text) lines.push(`AI: ${text}`);
      } else if (trimmed.startsWith("User")) {
        const text = trimmed.replace(/^User\s*/i, "").replace(/\d+:\d+:\d+\s*(AM|PM)\s*\(\+[\d.:]+\)/gi, "").trim();
        if (text) lines.push(`User: ${text}`);
      }
    }

    if (lines.length === 0) return null;
    const transcript = lines.join("\n");

    return {
      id: logId,
      transcript,
      customer: phone ? { number: `+${phone.startsWith("0") ? "44" + phone.slice(1) : phone}` } : null,
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
  } catch (e) {
    return null;
  }
}

/**
 * Extract caller name from transcript greeting
 */
function extractNameFromTranscript(transcript: string): string | null {
  if (!transcript) return null;
  const patterns = [
    /(?:my name is|i'm|i am|this is|call me)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
    /(?:^|\n)(?:User|Caller):\s*(?:Hi|Hello|Hey)[,!]?\s*(?:my name is|i'm|i am|this is)\s+([A-Z][a-z]+)/im,
  ];
  for (const pattern of patterns) {
    const match = transcript.match(pattern);
    if (match && match[1] && match[1].length > 1 && match[1].length < 30) {
      return match[1].trim();
    }
  }
  return null;
}

/**
 * Load transcripts from folders and create callers/calls
 */
async function importTranscripts() {
  console.log("\n📞 IMPORTING TRANSCRIPTS\n");
  console.log("━".repeat(60));

  const validFolders = TRANSCRIPTS_FOLDERS.filter((p) => {
    try { return fs.existsSync(p) && fs.statSync(p).isDirectory(); }
    catch { return false; }
  });

  if (validFolders.length === 0) {
    console.log("   ⚠️  No transcript folders found at:");
    TRANSCRIPTS_FOLDERS.forEach(p => console.log(`      - ${p}`));
    return { callersCreated: 0, callsCreated: 0 };
  }

  console.log("   Found folders:");
  validFolders.forEach(p => console.log(`      ✓ ${p}`));

  // Get default domain
  const domain = await prisma.domain.findFirst({ where: { slug: "mabel" } })
    || await prisma.domain.findFirst();

  const allCalls: VAPICall[] = [];

  // Scan for files
  for (const folder of validFolders) {
    const files = fs.readdirSync(folder);
    for (const file of files) {
      const filePath = path.join(folder, file);
      if (!fs.statSync(filePath).isFile()) continue;

      try {
        const content = fs.readFileSync(filePath, "utf-8");
        if (file.endsWith(".json")) {
          const json = JSON.parse(content);
          const calls = Array.isArray(json) ? json : (json.calls || [json]);
          allCalls.push(...calls);
        } else if (file.endsWith(".txt")) {
          const call = parseTextTranscript(content, file);
          if (call) allCalls.push(call);
        }
      } catch (e) {
        console.log(`   ⚠️  Failed to parse: ${file}`);
      }
    }
  }

  console.log(`\n   Found ${allCalls.length} total calls in files`);

  // Filter valid calls with transcripts and phone numbers
  const validCalls = allCalls.filter(
    (c) => c.transcript && c.transcript.trim().length > 0 && typeof c.customer === "object" && c.customer?.number
  );
  console.log(`   Valid calls with transcripts: ${validCalls.length}`);

  // Group by phone
  const callsByPhone = new Map<string, VAPICall[]>();
  for (const call of validCalls) {
    const phone = call.customer?.number || "";
    if (!phone) continue;
    const existing = callsByPhone.get(phone) || [];
    existing.push(call);
    callsByPhone.set(phone, existing);
  }

  // Sort each caller's calls by date
  for (const [, calls] of callsByPhone) {
    calls.sort((a, b) => new Date(a.startedAt || a.createdAt).getTime() - new Date(b.startedAt || b.createdAt).getTime());
  }

  let callersCreated = 0;
  let callsCreated = 0;

  // Create callers and calls
  for (const [phone, calls] of callsByPhone) {
    const customerInfo = calls[0].customer;
    let callerName = customerInfo?.name?.trim() || null;
    if (!callerName) {
      const transcriptName = extractNameFromTranscript(calls[0].transcript);
      callerName = transcriptName || `Caller ${phone.slice(-4)}`;
    }

    // Find or create caller
    let caller = await prisma.caller.findFirst({ where: { phone } });
    if (!caller) {
      caller = await prisma.caller.create({
        data: {
          name: callerName,
          phone,
          domainId: domain?.id,
          externalId: `vapi-${phone}`,
        },
      });
      callersCreated++;
      console.log(`   ✓ Created caller: ${callerName} (${phone})`);
    }

    // Get current call sequence
    let callSequence = 1;
    let previousCallId: string | null = null;
    const existingCalls = await prisma.call.findMany({
      where: { callerId: caller.id },
      orderBy: { callSequence: "desc" },
      take: 1,
    });
    if (existingCalls.length > 0 && existingCalls[0].callSequence) {
      callSequence = existingCalls[0].callSequence + 1;
      previousCallId = existingCalls[0].id;
    }

    // Create calls
    for (const vapiCall of calls) {
      const existingCall = await prisma.call.findFirst({
        where: { externalId: vapiCall.id },
      });
      if (existingCall) {
        previousCallId = existingCall.id;
        if (existingCall.callSequence) callSequence = existingCall.callSequence + 1;
        continue;
      }

      const createdCall = await prisma.call.create({
        data: {
          source: "vapi-import",
          externalId: vapiCall.id,
          callerId: caller.id,
          transcript: vapiCall.transcript,
          callSequence,
          previousCallId,
          createdAt: new Date(vapiCall.startedAt || vapiCall.createdAt),
        },
      });

      callsCreated++;
      previousCallId = createdCall.id;
      callSequence++;
    }
  }

  console.log(`\n   ✅ Imported ${callersCreated} callers, ${callsCreated} calls\n`);
  return { callersCreated, callsCreated };
}

async function clearConfigOnly() {
  console.log("\n🧹 CLEARING CONFIG (preserving callers & calls)\n");
  console.log("━".repeat(60));

  // Only clear config tables - NOT caller/call data
  const configTables = [
    // Playbook system
    "PlaybookItem",
    "Playbook",

    // Behavior targets (but NOT caller-specific targets)
    "BehaviorTarget",

    // Analysis specs
    "AnalysisAction",
    "AnalysisTrigger",
    "AnalysisSpec",

    // Prompt system
    "PromptSlugRange",
    "PromptSlugParameter",
    "PromptSlug",
    "PromptBlock",
    "PromptTemplate",

    // Parameters and anchors
    "ParameterScoringAnchor",
    "Parameter",

    // Domains (careful - callers reference these)
    // We'll upsert domains instead of deleting
  ];

  for (const table of configTables) {
    try {
      // @ts-ignore - dynamic table access
      const model = prisma[table.charAt(0).toLowerCase() + table.slice(1)];
      if (model) {
        const count = await model.count();
        if (count > 0) {
          await model.deleteMany();
          console.log(`   ✓ Cleared ${table}: ${count} rows`);
        }
      }
    } catch (e: any) {
      // Table might not exist or have FK issues
      console.log(`   ⚠ Skipped ${table}: ${e.message?.slice(0, 50)}`);
    }
  }

  console.log("\n   ✅ Config cleared (callers & calls preserved)\n");
}

async function seedDomains() {
  console.log("\n🏢 SEEDING DOMAINS (upsert)\n");

  const domains = [
    { slug: "wnf", name: "Why Nations Fail Tutor", description: "Educational tutoring for Why Nations Fail book concepts" },
    { slug: "wwii-tutor", name: "WWII Tutor", description: "Educational tutoring for World War II history" },
    { slug: "companion", name: "Companion", description: "Emotional support and companionship for elderly users" },
    { slug: "mabel", name: "Mabel", description: "Mabel companion domain for elderly support" },
    { slug: "general", name: "General", description: "General purpose domain" },
  ];

  for (const domain of domains) {
    await prisma.domain.upsert({
      where: { slug: domain.slug },
      update: { name: domain.name, description: domain.description },
      create: domain,
    });
    console.log(`   ✓ Upserted domain: ${domain.name}`);
  }
}

async function runSeedScripts() {
  console.log("\n📦 RUNNING SEED SCRIPTS\n");
  console.log("━".repeat(60));

  const scripts = [
    "seed-behavior-parameters.ts",
    "seed-system-specs.ts",
    "seed-prompt-slugs.ts",
    "seed-from-specs.ts",  // Creates Agents, Curricula from BDD specs
    "seed-wnf.ts",         // WNF domain, playbook, modules
    "seed-playbooks.ts",
  ];

  for (const script of scripts) {
    console.log(`\n   Running ${script}...`);
    try {
      execSync(`npx tsx prisma/${script}`, {
        cwd: process.cwd(),
        stdio: "inherit",
      });
      console.log(`   ✓ Completed ${script}`);
    } catch (e: any) {
      console.log(`   ⚠ Script ${script} had issues (continuing)`);
    }
  }
}

async function showStats() {
  console.log("\n📊 FINAL STATS\n");
  console.log("━".repeat(60));

  // Preserved data
  const callerCount = await prisma.caller.count();
  const callCount = await prisma.call.count();
  const memoryCount = await prisma.callerMemory.count();
  const scoreCount = await prisma.callScore.count();
  const promptCount = await prisma.composedPrompt.count();

  console.log("\n   PRESERVED DATA:");
  console.log(`   👥 Callers: ${callerCount}`);
  console.log(`   📞 Calls: ${callCount}`);
  console.log(`   💭 Memories: ${memoryCount}`);
  console.log(`   📊 Scores: ${scoreCount}`);
  console.log(`   📝 Composed Prompts: ${promptCount}`);

  // Refreshed config
  const specCount = await prisma.analysisSpec.count();
  const paramCount = await prisma.parameter.count();
  const playbookCount = await prisma.playbook.count();
  const targetCount = await prisma.behaviorTarget.count();
  const domainCount = await prisma.domain.count();

  console.log("\n   REFRESHED CONFIG:");
  console.log(`   📋 Analysis Specs: ${specCount}`);
  console.log(`   🎚️ Parameters: ${paramCount}`);
  console.log(`   📖 Playbooks: ${playbookCount}`);
  console.log(`   🎯 Behavior Targets: ${targetCount}`);
  console.log(`   🏢 Domains: ${domainCount}`);
}

async function main() {
  console.log("\n" + "═".repeat(60));
  console.log("   SAFE SEED - Refresh Config + Import Transcripts");
  console.log("═".repeat(60));

  try {
    // Step 1: Clear config only
    await clearConfigOnly();

    // Step 2: Seed domains (upsert to avoid breaking caller refs)
    await seedDomains();

    // Step 3: Run seed scripts
    await runSeedScripts();

    // Step 4: Import transcripts (creates callers/calls)
    await importTranscripts();

    // Step 5: Show stats
    await showStats();

    console.log("\n" + "═".repeat(60));
    console.log("   ✅ SAFE SEED COMPLETE");
    console.log("═".repeat(60) + "\n");

  } catch (error) {
    console.error("\n❌ Error during safe seed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
