#!/bin/bash

# dev-share - Start dev server with ngrok tunnel for easy sharing
# Creates a public URL that colleagues can access

set -e  # Exit on error

echo ""
echo "🌍 dev:share - DEV SERVER + PUBLIC TUNNEL"
echo "=========================================="
echo ""

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
  echo "❌ ngrok not found!"
  echo ""
  echo "Install with:"
  echo "   brew install ngrok"
  echo ""
  echo "Or download from: https://ngrok.com/download"
  echo ""
  exit 1
fi

# Kill any existing servers on port 3000
echo "🧹 Cleaning up existing servers..."
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
pkill -9 -f 'next-server' 2>/dev/null || true
echo "   ✓ Port 3000 cleared"
echo ""

# Clear Next.js cache
rm -rf .next
echo "   ✓ Cache cleared"
echo ""

# Start dev server in background
echo "🚀 Starting dev server..."
npm run dev > /tmp/dev-server.log 2>&1 &
DEV_PID=$!
echo "   Dev server starting (PID: $DEV_PID)"
echo ""

# Wait for server to be ready
echo "⏳ Waiting for server..."
npx wait-on http://localhost:3000 -t 60000 2>/dev/null
echo "   ✓ Server ready at http://localhost:3000"
echo ""

# Start ngrok tunnel
echo "🌐 Creating public tunnel..."
echo ""
echo "=========================================="
echo "🎉 YOUR PUBLIC URL:"
echo "=========================================="
echo ""

# Start ngrok and capture the URL
ngrok http 3000 --log=stdout 2>&1 | tee /tmp/ngrok.log &
NGROK_PID=$!

# Wait a moment for ngrok to start
sleep 3

# Extract and display the public URL
PUBLIC_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"https://[^"]*' | grep -o 'https://[^"]*' | head -1)

if [ -n "$PUBLIC_URL" ]; then
  echo "   $PUBLIC_URL"
  echo ""
  echo "=========================================="
  echo ""
  echo "📋 Share this URL with colleagues!"
  echo ""
  echo "⚠️  Security Note:"
  echo "   Anyone with this URL can access your admin panel"
  echo "   Consider adding auth before sharing widely"
  echo ""
  echo "📊 Monitor:"
  echo "   • Dev logs: /tmp/dev-server.log"
  echo "   • Ngrok logs: /tmp/ngrok.log"
  echo "   • Ngrok dashboard: http://localhost:4040"
  echo ""
  echo "🛑 Stop:"
  echo "   Press Ctrl+C to stop both server and tunnel"
  echo ""
else
  echo "   ⚠️  Could not detect ngrok URL"
  echo "   Check ngrok dashboard: http://localhost:4040"
  echo ""
fi

# Cleanup function
cleanup() {
  echo ""
  echo "🛑 Stopping..."
  kill $DEV_PID 2>/dev/null || true
  kill $NGROK_PID 2>/dev/null || true
  pkill -9 ngrok 2>/dev/null || true
  echo "   ✓ Server and tunnel stopped"
  exit 0
}

# Set up trap for clean shutdown
trap cleanup INT TERM

# Keep script running and tail dev logs
echo "📝 Dev server logs:"
echo "=========================================="
tail -f /tmp/dev-server.log
