#!/bin/bash

# devD - Data Reset Only 🔄
# Wipes database and reloads all data WITHOUT restarting server

set -e  # Exit on error

echo ""
echo "🔄 devD - DATA RESET ONLY"
echo "=========================================="
echo ""
echo "This will:"
echo "  1. 🗑️  Clear ALL database data"
echo "  2. 🔧 Reload domains, playbooks, specs, parameters"
echo "  3. 📝 Import all transcripts (callers + calls)"
echo "  4. ✨ Keep dev server running (no restart)"
echo ""

# Check if server is running
if ! curl -s http://localhost:3000 > /dev/null 2>&1; then
  echo "⚠️  WARNING: Dev server not detected at http://localhost:3000"
  echo "   Please start the server first with: npm run dev"
  echo ""
  exit 1
fi

# Step 1: Reset database
echo "📦 Step 1/3: Resetting database..."
npx tsx prisma/reset.ts --confirm
echo "   ✓ Database cleared"
echo ""

# Step 2: Seed system
echo "🌱 Step 2/3: Seeding system (domains, playbooks, specs)..."
SEED_RESPONSE=$(curl -s -X POST http://localhost:3000/api/x/seed-system)
SEED_OK=$(echo $SEED_RESPONSE | grep -o '"ok":\s*true' || echo "")

if [ -n "$SEED_OK" ]; then
  echo "   ✓ System seeded successfully"
  # Extract some stats from response
  SPECS=$(echo $SEED_RESPONSE | grep -o '"specsSynced":[0-9]*' | grep -o '[0-9]*' || echo "?")
  DOMAINS=$(echo $SEED_RESPONSE | grep -o '"domainsCreated":\[[^]]*\]' | grep -o ',' | wc -l || echo "?")
  echo "   📊 $SPECS specs synced, domains created"
else
  echo "   ⚠️  Seed system had issues (check response below):"
  echo "$SEED_RESPONSE" | head -c 500
  echo ""
fi
echo ""

# Step 3: Import transcripts
echo "📝 Step 3/3: Importing transcripts..."
TRANSCRIPT_RESPONSE=$(curl -s -X POST http://localhost:3000/api/x/seed-transcripts \
  -H "Content-Type: application/json" \
  -d '{"mode": "keep"}')

TRANSCRIPT_OK=$(echo $TRANSCRIPT_RESPONSE | grep -o '"ok":\s*true' || echo "")

if [ -n "$TRANSCRIPT_OK" ]; then
  echo "   ✓ Transcripts imported successfully"
  CALLS=$(echo $TRANSCRIPT_RESPONSE | grep -o '"callsImported":[0-9]*' | grep -o '[0-9]*' || echo "?")
  CALLERS=$(echo $TRANSCRIPT_RESPONSE | grep -o '"created":[0-9]*' | grep -o '[0-9]*' || echo "?")
  echo "   📊 $CALLERS callers created with $CALLS calls"
else
  echo "   ⚠️  Transcript import had issues (check response below):"
  echo "$TRANSCRIPT_RESPONSE" | head -c 500
  echo ""
fi
echo ""

# Done!
echo "✅ devD COMPLETE!"
echo "=========================================="
echo ""
echo "🎉 Your data is now fresh:"
echo "   • Database cleared and reloaded"
echo "   • All specs, domains, playbooks loaded"
echo "   • Transcripts imported"
echo "   • Dev server still running at http://localhost:3000"
echo ""
