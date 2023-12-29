# CGELabs
Welcome to the official repository for CGELabs. CGELabs is a sophisticated Electron-based application, tailored for executing bioinformatic workflows on x64 Linux systems. This tool is designed to facilitate local, efficient processing of bioinformatic data.

## Installation Instructions
1. Visit the GitHub page to identify the latest release version of CGELabs.
2. Use the wget command to download the appropriate .deb file from the CGE server, ensuring to replace the version number with the latest one. For example:
3. Install the downloaded package using the dpkg tool:
`sudo dpkg -i CGELabs-1.0.0.deb`
**Note:** This step installs only the front-end of CGELabs, which is not functional standalone. To fully utilize CGELabs, you must separately install the necessary bioinformatic tools and download the CGE_db. Detailed installation guidelines are available in the [Great-Life project repository](https://github.com/genomicepidemiology/great-life).

## Usage Guide
1. Launch CGELabs from the applications menu.
2. Choose the desired workflow.
3. Input all required parameters. This typically includes a unique experiment name and the selection of a .fastq file for analysis.
4. Initiate the experiment and monitor the real-time output in the integrated terminal window. Upon completion, the results will be accessible through the app's results page.

## Development Setup
### Prerequisites
Ensure the installation of the following dependencies:
`sudo apt install nodejs npm`

2. Electron:
`npm install electron`
3. Electron-packager:
`npm install electron-packager`
4. Electron-builder:
`npm install electron-builder`
5. Electron-installer-debian:
`npm install electron-installer-debian`


### Build Process
To build CGELabs:
1. Clone the repository to your local machine.
2. Navigate to the cloned repository directory and execute:
`npm install`
This command installs all necessary dependencies.
3. To build the application, run:
`npm run dist`
The built application package will be located in `build/CGELabs-<version>.deb`.



