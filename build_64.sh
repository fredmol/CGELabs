#!/bin/bash
# Update build script to support both Linux and Mac

# Clean previous builds
rm -rf dist

# Detect platform
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS build
    echo "Building for macOS..."
    npx electron-packager . CGELabs --platform=darwin --arch=x64 --overwrite
    # Create DMG (requires electron-installer-dmg package)
    npx electron-installer-dmg --overwrite CGELabs-darwin-x64/CGELabs.app CGELabs
    mkdir -p dist/installer
    mv CGELabs.dmg dist/installer/
else
    # Linux build
    echo "Building for Linux..."
    npx electron-packager . CGELabs --platform=linux --arch=x64 --overwrite
    npx electron-installer-debian --src CGELabs-linux-x64/ --arch amd64 --dest dist/installer/ --config debian.json
fi

echo "Build completed!"