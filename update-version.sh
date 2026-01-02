#!/bin/bash

# Beatz by Elle - Version Updater
# Automatically increments version numbers to bust browser cache
# Run this after making changes to CSS, JavaScript, or HTML files

echo "🎵 Beatz by Elle - Cache Buster"
echo "================================"

# Get current version from index.html
CURRENT_VERSION=$(grep -o '?v=20[0-9]*-[0-9]*' index.html | head -1 | cut -d'=' -f2)

if [ -z "$CURRENT_VERSION" ]; then
    echo "❌ Could not find current version in index.html"
    exit 1
fi

echo "📦 Current version: $CURRENT_VERSION"

# Extract date and number
VERSION_DATE=$(echo $CURRENT_VERSION | cut -d'-' -f1)
VERSION_NUM=$(echo $CURRENT_VERSION | cut -d'-' -f2)

# Increment version number
NEW_NUM=$((VERSION_NUM + 1))
NEW_VERSION="${VERSION_DATE}-${NEW_NUM}"

echo "🚀 New version: $NEW_VERSION"

# Update index.html (macOS sed syntax)
sed -i '' "s/?v=$CURRENT_VERSION/?v=$NEW_VERSION/g" index.html

echo "✅ Updated all version numbers in index.html"
echo ""
echo "� Next steps:"
echo "   1. Refresh your browser with Cmd + Shift + R"
echo "   2. If still cached, clear browser cache (Cmd + Shift + Delete)"
echo ""
echo "💡 Your app is at: http://localhost:9000"
echo "🌐 Now refresh your browser with: Cmd+Shift+R (hard refresh)"
echo "   Or just press F5 or Cmd+R (normal refresh should work now)"
