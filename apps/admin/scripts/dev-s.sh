#!/bin/bash

# devS - Spec Reload Only 🌱
# Reloads BDD specs, playbooks, and configs WITHOUT touching caller data

set -e  # Exit on error

echo ""
echo "🌱 devS - SPEC RELOAD"
echo "=========================================="
echo ""
echo "This will:"
echo "  1. ♻️  Reload specs (voice rules, behavior targets, etc.)"
echo "  2. 🔄 Update playbook configurations"
echo "  3. ✅ Keep all caller data (memories, calls, measurements)"
echo ""

# Check if server is running
if ! curl -s http://localhost:3000 > /dev/null 2>&1; then
  echo "❌ Error: Dev server not running!"
  echo ""
  echo "Start the server first with:"
  echo "   npm run dev"
  echo ""
  exit 1
fi

echo "✓ Dev server detected at http://localhost:3000"
echo ""

# Seed system specs
echo "🌱 Reloading specs..."
SEED_RESPONSE=$(curl -s -X POST http://localhost:3000/api/x/seed-system)
SEED_OK=$(echo $SEED_RESPONSE | grep -o '"ok":\s*true' || echo "")

if [ -n "$SEED_OK" ]; then
  echo "   ✓ Specs reloaded successfully"

  # Extract stats from response
  SPECS=$(echo $SEED_RESPONSE | grep -o '"specsSynced":[0-9]*' | grep -o '[0-9]*' || echo "?")
  DOMAINS=$(echo $SEED_RESPONSE | grep -o '"domainsCreated":\[[^]]*\]' | grep -o ',' | wc -l || echo "?")

  echo ""
  echo "   📊 Stats:"
  echo "      • $SPECS specs synced"
  echo "      • Domains updated"
  echo "      • Playbook configs refreshed"
  echo ""
else
  echo "   ⚠️  Spec reload had issues:"
  echo "$SEED_RESPONSE" | head -c 500
  echo ""
  exit 1
fi

# Start/restart ngrok tunnel
echo "🌍 Creating public tunnel..."

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
  echo "   ⚠️  ngrok not found - skipping tunnel creation"
  echo "   Install with: brew install ngrok"
  echo ""
else
  # Check if ngrok is already running
  if curl -s http://localhost:4040/api/tunnels > /dev/null 2>&1; then
    # Extract existing URL
    PUBLIC_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"https://[^"]*' | grep -o 'https://[^"]*' | head -1)
    if [ -n "$PUBLIC_URL" ]; then
      echo "   ✓ Tunnel already running"
      echo ""
      echo "=========================================="
      echo "🌍 PUBLIC URL (share with colleagues):"
      echo "=========================================="
      echo ""
      echo "   $PUBLIC_URL"
      echo ""
      echo "=========================================="
      echo ""
    fi
  else
    # Start new ngrok tunnel
    pkill -9 ngrok 2>/dev/null || true
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
fi

# Done!
echo "✅ devS COMPLETE!"
echo "=========================================="
echo ""
echo "🎉 Updated:"
echo "   • Voice rules (response length, pacing)"
echo "   • Behavior targets (warmth, question rate, etc.)"
echo "   • Playbook configurations"
echo ""
echo "📝 Preserved:"
echo "   • All callers and their data"
echo "   • Call history and transcripts"
echo "   • Measurements and targets"
echo "   • Memories and personality profiles"
echo ""
echo "📊 Monitor:"
if command -v ngrok &> /dev/null && [ -n "$PUBLIC_URL" ]; then
  echo "   • Public URL: $PUBLIC_URL"
  echo "   • Ngrok dashboard: http://localhost:4040"
fi
echo "   • Local: http://localhost:3000"
echo ""
echo "Next prompts will use the new configurations!"
echo ""
