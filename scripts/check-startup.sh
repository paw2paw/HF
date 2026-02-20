#!/bin/bash
set -e

echo ""
echo "🚀 HF Project Startup Check"
echo "════════════════════════════"
echo ""

# Check MCP Servers
echo "📡 MCP Servers:"
if command -v claude &> /dev/null; then
  cd /Users/paulwander/projects/HF
  claude mcp list 2>/dev/null || echo "⚠️  MCP servers may not be connected (check Claude Code)"
else
  echo "⚠️  Claude Code CLI not in PATH"
fi

# Check qmd index status (if qmd installed)
if command -v qmd &> /dev/null; then
  echo ""
  echo "📚 qmd Index Status:"
  qmd status 2>/dev/null | grep -E "(Index|Size|Documents|Collections|MCP)" || echo "⚠️  qmd index not initialized"
else
  echo "⚠️  qmd CLI not installed"
fi

# Check hf-graph database
if [ -f /Users/paulwander/projects/HF/.cache/hf-graph.sqlite ]; then
  echo ""
  echo "📊 hf-graph Database:"
  SIZE=$(du -h /Users/paulwander/projects/HF/.cache/hf-graph.sqlite | cut -f1)
  echo "   Size: $SIZE"
  echo "   ✓ Indexed"
else
  echo "⚠️  hf-graph index not found (will be created on first use)"
fi

echo ""
echo "✅ Startup check complete"
echo ""
