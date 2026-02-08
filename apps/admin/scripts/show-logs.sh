#!/bin/bash
# Show live dev server logs in a right-side terminal window (1/4 screen width)

# Get screen dimensions
SCREEN_WIDTH=$(osascript -e 'tell application "Finder" to get bounds of window of desktop' | awk '{print $3}')
SCREEN_HEIGHT=$(osascript -e 'tell application "Finder" to get bounds of window of desktop' | awk '{print $4}')

# Calculate window position and size (right 1/4 of screen)
WINDOW_WIDTH=$((SCREEN_WIDTH / 4))
WINDOW_HEIGHT=$SCREEN_HEIGHT
X_POS=$((SCREEN_WIDTH - WINDOW_WIDTH))
Y_POS=0

# Create the log file if it doesn't exist
touch /tmp/dev-server.log

# Open Terminal with positioned window
osascript <<EOF
tell application "Terminal"
    activate
    set newWindow to do script "tail -f /tmp/dev-server.log"
    tell window 1
        set position to {$X_POS, $Y_POS}
        set size to {$WINDOW_WIDTH, $SCREEN_HEIGHT}
    end tell
end tell
EOF

echo "✅ Log viewer opened on right side (1/4 screen)"
echo "   Showing: /tmp/dev-server.log"
echo ""
echo "Tip: Press Cmd+Q in the Terminal window to close it"
