npx electron-packager . CGELabs --platform=linux --arch=x64
npx electron-installer-debian --src CGELabs-linux-x64/ --arch amd64 --dest dist/installer/ --config debian.json

