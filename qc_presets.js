/**
 * QC Preset Parameters for CGELabs
 * These presets are used to configure the CGE QC tool for different types of data
 */

// Bacterial trim parameters
const BACTERIAL_TRIM_PRESETS = {
    min_length: 500,
    max_length: 2147483647,
    min_phred: 20,
    min_internal_phred: 0,
    min_average_quality: 10,
    trim_5_prime: 0,
    trim_3_prime: 0
};

// Viral trim parameters
const VIRAL_TRIM_PRESETS = {
    min_length: 100,
    max_length: 500000, // Mpox is around 280k
    min_phred: 20,
    min_internal_phred: 0,
    min_average_quality: 10,
    trim_5_prime: 0,
    trim_3_prime: 0
};

// Metagenomic trim parameters
const METAGENOMIC_TRIM_PRESETS = {
    min_length: 500,
    max_length: 2147483647,
    min_phred: 20,
    min_internal_phred: 0,
    min_average_quality: 10,
    trim_5_prime: 0,
    trim_3_prime: 0
};

// Export the presets for use in renderer.js
module.exports = {
    BACTERIAL_TRIM_PRESETS,
    VIRAL_TRIM_PRESETS,
    METAGENOMIC_TRIM_PRESETS
};
