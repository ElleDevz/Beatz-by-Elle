#!/bin/bash

# Beatz by Elle - Development Server Launcher
# This script starts the server and opens your browser automatically

echo "🎵 Starting Beatz by Elle Development Server..."

# Kill any existing Python servers to avoid conflicts
pkill -f "python3 -m http.server" 2>/dev/null

# Generate random port to avoid cache issues
PORT=$((8000 + RANDOM % 2000))

echo "🚀 Server starting on port $PORT"
echo "📂 Serving from: $(pwd)"
echo ""
echo "🌐 Open in your browser: http://localhost:$PORT"
echo ""
echo "💡 TIP: Press Ctrl+C to stop the server"
echo ""

# Start server in background
python3 -m http.server $PORT &
SERVER_PID=$!

# Wait a moment for server to start
sleep 1

# Open in default browser
open "http://localhost:$PORT"

# Wait for user to stop
wait $SERVER_PID
