#!/bin/bash

# devZZZ - The Ultimate Nuclear Reset 💣💣💣
# Complete database wipe + system reload + transcript import + dev server

set -e  # Exit on error

echo ""
echo "🚀💣💣 devZZZ - NUCLEAR DEV RESET 💣💣🚀"
echo "=========================================="
echo ""
echo "This will:"
echo "  1. 🗑️  Clear ALL database data"
echo "  2. 🔧 Reload domains, playbooks, specs, parameters"
echo "  3. 📝 Import all transcripts (callers + calls)"
echo "  4. 🌟 Start fresh dev server"
echo ""

# Step 1: Reset database
echo "📦 Step 1/4: Resetting database..."
npx tsx prisma/reset.ts --confirm
echo "   ✓ Database cleared"
echo ""

# Step 2: Kill existing servers and clear cache
echo "🔪 Step 2/4: Killing existing servers..."
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
pkill -9 -f 'next-server' || true
rm -rf .next
echo "   ✓ Port 3000 cleared, .next cache removed"
echo ""

# Step 3: Start dev server in background
echo "🌐 Step 3/4: Starting dev server..."
npm run dev > /tmp/nextjs-dev.log 2>&1 &
DEV_PID=$!
echo "   Dev server starting (PID: $DEV_PID)..."

# Wait for server to be ready
echo "   Waiting for http://localhost:3000 to be ready..."
npx wait-on http://localhost:3000 -t 60000
echo "   ✓ Dev server ready!"
echo ""

# Step 4: Seed system
echo "🌱 Step 4a/5: Seeding system (domains, playbooks, specs)..."
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

# Step 5: Import transcripts
echo "📝 Step 4b/5: Importing transcripts..."
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

# Step 6: Start ngrok tunnel for sharing
echo "🌍 Step 5/5: Creating public tunnel..."

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
  echo "   ⚠️  ngrok not found - skipping tunnel creation"
  echo "   Install with: brew install ngrok"
  echo ""
else
  # Kill any existing ngrok processes
  pkill -9 ngrok 2>/dev/null || true

  # Start ngrok in background
  ngrok http 3000 --log=stdout > /tmp/ngrok.log 2>&1 &
  NGROK_PID=$!

  # Wait for ngrok to start
  sleep 3

  # Extract public URL
  PUBLIC_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | grep -o '"public_url":"https://[^"]*' | grep -o 'https://[^"]*' | head -1)

  if [ -n "$PUBLIC_URL" ]; then
    echo "   ✓ Public tunnel created!"
    echo ""
    echo "=========================================="
    echo "🌍 PUBLIC URL (share with colleagues):"
    echo "=========================================="
    echo ""
    echo "   $PUBLIC_URL"
    echo ""
    echo "=========================================="
    echo ""
  else
    echo "   ⚠️  Could not detect ngrok URL"
    echo "   Check dashboard: http://localhost:4040"
    echo ""
  fi
fi

# Done!
echo "✅ devZZZ COMPLETE!"
echo "=========================================="
echo ""
echo "🎉 Your system is now:"
echo "   • Completely fresh database"
echo "   • All specs, domains, playbooks loaded"
echo "   • Transcripts imported"
echo "   • Dev server running at http://localhost:3000"
if [ -n "$PUBLIC_URL" ]; then
  echo "   • Public URL: $PUBLIC_URL"
fi
echo ""
echo "📊 Monitor:"
echo "   • Dev logs: /tmp/nextjs-dev.log"
if command -v ngrok &> /dev/null; then
  echo "   • Ngrok dashboard: http://localhost:4040"
fi
echo "   • Dev server PID: $DEV_PID"
echo ""
echo "🛑 Press Ctrl+C to stop everything"
echo ""

# Cleanup function
cleanup() {
  echo ""
  echo "🛑 Stopping..."
  kill $DEV_PID 2>/dev/null || true
  pkill -9 ngrok 2>/dev/null || true
  echo "   ✓ Server and tunnel stopped"
  exit 0
}

# Set up trap for clean shutdown
trap cleanup INT TERM

# Tail the logs to keep the script running and show output
tail -f /tmp/nextjs-dev.log
