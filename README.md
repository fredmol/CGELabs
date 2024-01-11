# CGELabs
Welcome to the official repository for CGELabs. CGELabs is a sophisticated Electron-based application, tailored for executing bioinformatic workflows on x64 Linux systems. This tool is designed to facilitate local, efficient processing of bioinformatic data.

## Front-end Installation Instructions for CGELabs
1. Visit the GitHub page to identify the latest release version of CGELabs.
2. Use the wget command to download the appropriate .deb file from the CGE server, ensuring to replace the version number with the latest one. For example:
`wget https://cge.food.dtu.dk/services/great-life/CGELabs_1.0.0_amd64.deb`
4. Install the downloaded package using the dpkg tool:
`sudo dpkg -i CGELabs_1.0.0_amd64.deb`
**Important Note:** This step installs only the front-end of CGELabs, which is not functional standalone. To fully utilize CGELabs, you must separately install the necessary bioinformatic tools and download the cge_db. Detailed installation guidelines are available in the [Great-Life project repository](https://github.com/genomicepidemiology/great-life) or below.

## Back-end Installation Instructions
The back-end bioinformatic tools are managed by the conda package manager. The following installation guide assumes anaconda3 in installed in the user's home path as described in [Great-Life project repository](https://github.com/genomicepidemiology/great-life). 
To install the necessary tools, follow these steps:
1. Download the cge_env environment file from the CGE server:

`wget https://cge.cbs.dtu.dk/services/great-life/cge_env.yml`

2. Create a new conda environment using the downloaded environment file:

`conda env create -f cge_env.yml -n cge_env`

**Note:** The environment named must be cge_env for CGELabs to function properly. 
If the environment is already installed it can be updated using:

`conda update --all -n cge_env -c genomicepidemiology`

3. Download the CGELabs setup script from the CGE server:

`wget https://cge.cbs.dtu.dk/services/great-life/setup_cge.py`

4. Execute the setup script:

`sudo python3 setup_cge.py`

5. Download the cge_db from the CGE server:

`wget https://cge.cbs.dtu.dk/services/great-life/cge_db.tar.gz`

6. Extract the cge_db:

`tar -xvzf cge_db.tar.gz`

7. Move the cge_db to the CGELabs directory:

`mv cge_db /var/lib/cge/database/cge_db`

## Dependencny check
To check if all dependencies are installed correctly, download the dependency check script from the CGE server:
`wget https://cge.cbs.dtu.dk/services/great-life/cgelabs_dependency_check.py`
Execute the script:
`python3 cgelabs_dependency_check.py`

## Usage Guide
1. Launch CGELabs from the applications menu.
2. Choose the desired workflow. (To learn more about the workflows, visit the [Great-Life project repository](https:://github.com/genomicepidemiology/great-life).)
3. Input all required parameters. This typically includes a unique experiment name and the selection of a .fastq file for analysis. All the analytical tools take a single .fastq file per analysis. If you have fresh Oxford Nanopore Sequencing output which is comprised on many, smaller files, these files can be merged using the in-app merge function. All output results will be located in /var/lib/cge/results/<experiment_name>.
4. Initiate the experiment and monitor the real-time output in the integrated terminal window. Upon completion, the results will be accessible through the app's results page.

## Development Setup
This section should only be used by developers who wish to contribute to the development of CGELabs. The following instructions are for building the application from source.
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

### Future Development
If new features are developed and to be released, the developer should build the application using the build process described above. The new .deb file should then be uploaded to the CGE server under /home/www/htdocs/services/great-life/ .



