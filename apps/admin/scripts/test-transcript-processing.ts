/**
 * Test script for transcript processing
 */

import { processTranscripts } from "../lib/ops/transcripts-process";

async function main() {
  console.log("Starting transcript processing test...");
  console.log("===========================================\n");

  const result = await processTranscripts({
    autoDetectType: true,
    createCallers: true
  });

  console.log("\n===========================================");
  console.log("PROCESSING COMPLETE");
  console.log("===========================================");
  console.log(JSON.stringify(result, null, 2));

  if (result.success) {
    console.log("\n✓ Processing completed successfully!");
  } else {
    console.log("\n✗ Processing completed with errors:");
    result.errors.forEach(err => console.log(`  - ${err}`));
  }
}

main().catch(console.error);
