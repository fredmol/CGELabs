# CGELabs
Welcome to the official repository for CGELabs. CGELabs is a sophisticated Electron-based application, tailored for executing bioinformatic workflows on both Mac OS and Linux systems. This tool is designed to facilitate local, efficient processing of bioinformatic data.

## Installation Instructions

### Option 1: Download Pre-built Binary
1. Visit the GitHub page to identify the latest release version of CGELabs.
2. Download the appropriate package for your system:
   - For Linux: `CGELabs_[version]_amd64.deb`
   - For Mac: `CGELabs_[version].dmg`
3. Install the package:
   - Linux: `sudo dpkg -i CGELabs_[version]_amd64.deb`
   - Mac: Open the DMG file and drag CGELabs to your Applications folder

**Important Note:** This installs only the front-end of CGELabs. You must separately install the bioinformatic tools and download the database as described below.

### Option 2: Build from Source
See the Development Setup section below.

## Back-end Setup

The back-end requires bioinformatic tools that can be installed via conda or other package managers.

### Required Tools
- cgeisolate (Bacterial Analysis)
- cgevirus (Virus Analysis) 
- cgemetagenomics (Metagenomics Analysis)
- cgeqc (Quality Control)

### Recommended Setup Method with Conda
1. Download the cge_env environment file:
   ```
   wget https://cge.cbs.dtu.dk/services/great-life/cge_env.yml
   ```

2. Create a conda environment with the required tools:
   ```
   conda env create -f cge_env.yml -n cge_env
   ```

3. Download and set up the CGE database:
   ```
   wget https://cge.cbs.dtu.dk/services/great-life/cge_db.tar.gz
   tar -xvzf cge_db.tar.gz
   sudo mkdir -p /var/lib/cge/database
   sudo mv cge_db /var/lib/cge/database/cge_db
   ```

### Custom Installation Paths
CGELabs now supports custom installation paths through environment variables:
- `CGE_RESULTS_DIR`: Custom location for analysis results (default: `/var/lib/cge/results`)
- `CGE_DB_DIR`: Custom location for the CGE database (default: `/var/lib/cge/database/cge_db`)

Set these variables before launching CGELabs:
```
export CGE_RESULTS_DIR=/path/to/results
export CGE_DB_DIR=/path/to/database/cge_db
```

## Dependency Check
CGELabs will automatically check for required tools at startup and display a notification if any are missing.

## Usage Guide
1. Launch CGELabs from the applications menu.
2. Choose the desired workflow:
   - Bacterial Analysis - Uses cgeisolate
   - Viral Analysis - Uses cgevirus
   - Metagenomics Analysis - Uses cgemetagenomics
3. Input required parameters:
   - Experiment name (unique identifier)
   - FastQ file for analysis
   - Optional QC parameters
4. Start the analysis and monitor progress in the console output.
5. View results after completion:
   - Results are accessible through the app's Results page
   - Default location: `/var/lib/cge/results/<experiment_name>` (or your custom path)

## Development Setup
For developers who wish to contribute to CGELabs.

### Prerequisites
- Node.js and npm
- Electron: `npm install electron`
- For building packages:
  ```
  npm install electron-packager electron-builder electron-installer-debian electron-installer-dmg
  ```

### Build Process
1. Clone the repository
2. Install dependencies: `npm install`
3. Run in development mode: `npm start`
4. Build:
   - For current platform: `npm run dist`
   - Cross-platform: `./build.sh`

The built packages will be located in `dist/installer/`.

### Future Development
New releases should be built using the build process described above and uploaded to the CGE server.