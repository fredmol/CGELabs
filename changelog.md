# Changelog

## [1.6.0] - 2025-03-10
### Added
- Cross-Platform Support
  - Mac OS compatibility alongside Linux
  - Platform-aware conda path detection
  - Flexible file path handling

- Flexible Installation Options
  - Environment variable support for custom installation paths
  - Support for custom database and results directories via CGE_DB_DIR and CGE_RESULTS_DIR
  - Enhanced dependency detection without enforcing specific environment names

### Enhanced
- Dependency Management
  - Non-blocking dependency check notifications
  - Improved tool availability checking
  - Better error messages for missing dependencies
  - Graceful handling of missing tools
  - Updated ReadMe to reflect changes to CGELabs

### Technical Improvements
- Enhanced error handling for cross-platform compatibility
- Code refactoring for better maintainability
- Updated build system with cross-platform scripts

## [1.5.0] - 2025-02-28
### Enhanced
- Quality Control System
  - Improved cgeqc integration with dataset-specific quality assessment
  - Added specialized thresholds for bacterial, viral, and metagenomic data
  - Optimized parameter handling between CGELabs and cgeqc

### Fixed
- Parameter validation in QC tool calls
- Automatic data type detection and reporting

## [1.4.0] - 2025-02-27
### Enhanced
- File Selection System
  - Fixed issue with file type selection dialogs
  - Implemented native file dialogs with proper file type filtering
  - Added folder icons to browse buttons for better visual cues

### Redesigned
- Results Page
  - Improved table layout with better spacing and color scheme
  - Simplified action buttons for better usability
  - Added direct folder access buttons for each result

- FastQ Merge Tool
  - Updated interface to match other analysis tools
  - Added consistent styling and functionality
  - Improved console output and status indicators
  - Enhanced result display formatting

- Landing Page
  - Completely redesigned a more compact layout
  - Separated tools into Analysis and Utility categories

## [1.3.1] - 2025-02-26
### Refactored
- Comprehensive code restructuring across main.js, renderer.js and styles.css
  - Improved code organization and readability
  - Eliminated redundant code patterns
  - Enhanced performance and maintainability


## [1.3.0] - 2025-02-26
### Added
- Collapsible Information Panels
  - Added "About This Analysis" section with expandable details

### Enhanced
- Complete UI Redesign
  - Implemented card-based layout for better visual organization
  - Created clearer separation between different functional sections
  - Redesigned results section for improved clarity
  - Reduced overall UI scale to 80% for better space utilization

### Improved
- Status Indicators
  - Added dynamic status icons showing waiting/running/success/error states
  - Improved visual feedback during analysis progress


## [1.2.2] - 2025-02-26
### Added
- QC Report Integration
  - Added QC report column to results table
  - Added dedicated QC report viewing buttons on analysis pages
  - QC reports can be viewed in-app or externally

### Enhanced
- User Interface Improvements
  - Improved QC settings button visibility with green color scheme
  - Implemented collapsible console output with status summary
  - Console now shows just the latest line by default with option to expand

## [1.2.1] - 2025-02-25
### Added
- Quality Control Parameter panel integration
  - QC parameters can now be customized for all of the different CGEtools. The parameters are passed on to cgeqc
  - Real-time output will display QC parameters used
  - The tool will auto detect if values are beyond expected range and fallback to default values


## [1.2.0] - 2025-02-20
### Added
- Quality Control Integration
  - Added pre-analysis QC step using cgeqc tool
  - QC can be enabled/disabled via checkbox (enabled by default)
  - Automatic handling of trimmed files for downstream analysis
  - Real-time output display for QC process
  - Enhanced error handling with fallback to original files

## [1.1.3] - 2025-01-29
### Enhanced
- Virus Analysis Page
  - Updated layout to match bacteria and metagenomics pages
  - Added file size warning system
  - Added experiment name validation
  - Added cancel analysis functionality
  - Added results handling with PDF and text report viewing
  - Added virus-specific info section
  - Improved real-time output display
  - Enhanced error handling and user feedback

## [1.1.2] - 2025-01-10
### Added
- Metagenomics Page
  - Matched layout and functionality with bacteria page
  - Added file size warning system
  - Added experiment name validation
  - Added cancel analysis functionality
  - Added results handling with PDF and text report viewing
  - Added metagenomics-specific info section

### Enhanced
- Input Validation
  - Added character validation for experiment names (both bacteria and metagenomics)
  - Only allows letters, numbers, underscores, and hyphens
  - Real-time validation feedback
  - Integrated with existing folder existence checks
  - Clear warning messages for invalid inputs
  

## [1.1.1] - 2025-01-10
### Enhanced

- Results Page
  - Added sortable table columns (Name, Tool Type, Date)
  - Implemented 24-hour clock format for timestamps
  - Added chronological sorting (newest first by default)
  - Improved sort indicators with directional arrows



### Changed

- Bacteria Page
  - Streamlined UI with removal of card container

## [1.1.0] - 2025-01-09

### Added
- Landing Page
  - Animated welcome header with logo
  - Interactive feature cards with dynamic grid layout
  - Hidden sidebar functionality

- Navigation & Interface
  - Enhanced sidebar with icons and hover effects
  - Seamless page transitions
  - Font Awesome icons integration
  - Consistent color scheme and animations

- Results Management
  - Interactive expandable rows for analysis details
  - Real-time search functionality
  - PDF report viewing capabilities

- File Management System
  - Quick access to results directory
  - Delete functionality for individual analyses
  - Text and PDF report viewing options
  - Automatic tool type tracking
  
- Bacterial analysis (CGE isolate)
  - Added checks and warnings for large & small file sizes
  - Added checks for existing sample names
  - Added links straight to results after analysis finishes
  - Improved general layout and functionality

### Fixed
- Console output duplication issue
- Page load error handling
- Content centering issues

### Changed
- Terminal Output
  - Improved readability with monospace font
  - Dark theme with better contrast
  - Enhanced scrolling behavior

- Input Elements
  - Modernized file upload area with drag-and-drop
  - Improved text input field styling
  - Enhanced warning message system

### Technical
- Modular CSS structure implementation
- Streamlined event handler organization
- Improved page state management
- Enhanced error messaging system


## [1.0.0] - Initial Release

### Initial CGELabs release with basic functionality	
