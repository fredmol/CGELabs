rm -rf dist
npx electron-packager . CGELabs --platform=linux --arch=x64 --overwrite
npx electron-installer-debian --src CGELabs-linux-x64/ --arch amd64 --dest dist/installer/ --config debian.json

