/**
 * Comprehensive iReady Data Reload Script
 * Processes all CSV files from References/iReady Data directories
 * Handles ELA and Math data for Current_Year, Current_Year-1, and Current_Year-2
 */

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// School year mappings
const SCHOOL_YEAR_MAPPING = {
  'Current_Year': '2024-2025',
  'Current_Year-1': '2023-2024', 
  'Current_Year-2': '2022-2023'
};

const ACADEMIC_YEAR_MAPPING = {
  '2024-2025': 2024,
  '2023-2024': 2023,
  '2022-2023': 2022
};

class IReadyDataLoader {
  constructor() {
    this.importBatchId = uuidv4();
    this.totalProcessed = 0;
    this.errors = [];
    this.stats = {
      filesProcessed: 0,
      recordsProcessed: 0,
      recordsInserted: 0,
      errors: 0
    };
  }

  /**
   * Parse CSV file and return records
   */
  async parseCSV(filePath) {
    return new Promise((resolve, reject) => {
      const records = [];
      const stream = fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          records.push(row);
        })
        .on('end', () => {
          console.log(`✅ Parsed ${records.length} records from ${path.basename(filePath)}`);
          resolve(records);
        })
        .on('error', (error) => {
          console.error(`❌ Error parsing ${filePath}:`, error);
          reject(error);
        });
    });
  }

  /**
   * Transform CSV row to database record
   */
  transformRecord(row, subject, schoolYear, csvSource) {
    // Extract placement and convert to our format
    const convertPlacement = (placement) => {
      const placements = {
        '3+ Grade Levels Below': 'THREE_OR_MORE_GRADE_LEVELS_BELOW',
        '2 Grade Levels Below': 'TWO_GRADE_LEVELS_BELOW', 
        '1 Grade Level Below': 'ONE_GRADE_LEVEL_BELOW',
        'Early On Grade Level': 'ON_GRADE_LEVEL',
        'Mid or Above Grade Level': 'ON_GRADE_LEVEL',
        'On Grade Level': 'ON_GRADE_LEVEL',
        '1 Grade Level Above': 'ONE_GRADE_LEVEL_ABOVE',
        '2 Grade Levels Above': 'TWO_GRADE_LEVELS_ABOVE',
        '3+ Grade Levels Above': 'THREE_OR_MORE_GRADE_LEVELS_ABOVE'
      };
      
      // Try direct mapping first
      if (placements[placement]) {
        return placements[placement];
      }
      
      // Handle grade-specific placements like "Grade 5", "Early 6", etc.
      if (placement.includes('Grade Level Below')) {
        if (placement.includes('3')) return 'THREE_OR_MORE_GRADE_LEVELS_BELOW';
        if (placement.includes('2')) return 'TWO_GRADE_LEVELS_BELOW';
        if (placement.includes('1')) return 'ONE_GRADE_LEVEL_BELOW';
      }
      
      if (placement.includes('Grade Level Above')) {
        if (placement.includes('3')) return 'THREE_OR_MORE_GRADE_LEVELS_ABOVE';
        if (placement.includes('2')) return 'TWO_GRADE_LEVELS_ABOVE'; 
        if (placement.includes('1')) return 'ONE_GRADE_LEVEL_ABOVE';
      }
      
      // Default to ON_GRADE_LEVEL for unclear cases
      return 'ON_GRADE_LEVEL';
    };

    const parseDate = (dateStr) => {
      if (!dateStr) return null;
      try {
        const date = new Date(dateStr);
        return date.toISOString().split('T')[0]; // YYYY-MM-DD format
      } catch {
        return null;
      }
    };

    const parseNumber = (val) => {
      if (!val || val === '' || val === 'Not Assessed' || val === 'Not Provided') return null;
      const num = parseFloat(val);
      return isNaN(num) ? null : num;
    };

    const parseGradeLevel = (val) => {
      if (!val || val === '' || val === 'Not Assessed' || val === 'Not Provided') {
        // Default to grade 0 if no grade level provided (to satisfy NOT NULL constraint)
        return 0;
      }
      const num = parseFloat(val);
      return isNaN(num) ? 0 : num;
    };

    return {
      id: uuidv4(),
      student_id: null, // Will be populated later if needed
      aeries_student_id: row['Student ID'],
      student_name: `${row['First Name']} ${row['Last Name']}`,
      school_year: schoolYear,
      subject: subject,
      diagnostic_date: parseDate(row['Completion Date']),
      grade_level: parseGradeLevel(row['Student Grade']),
      overall_scale_score: parseNumber(row['Overall Scale Score']),
      overall_placement: convertPlacement(row['Overall Relative Placement'] || ''),
      
      // ELA-specific fields
      phonological_awareness_score: subject === 'ELA' ? parseNumber(row['Phonological Awareness Scale Score']) : null,
      phonics_score: subject === 'ELA' ? parseNumber(row['Phonics Scale Score']) : null,
      high_frequency_words_score: subject === 'ELA' ? parseNumber(row['High-Frequency Words Scale Score']) : null,
      vocabulary_score: subject === 'ELA' ? parseNumber(row['Vocabulary Scale Score']) : null,
      literary_comprehension_score: subject === 'ELA' ? parseNumber(row['Comprehension: Literature Scale Score']) : null,
      informational_comprehension_score: subject === 'ELA' ? parseNumber(row['Comprehension: Informational Text Scale Score']) : null,
      
      // Math-specific fields
      number_and_operations_score: subject === 'MATH' ? parseNumber(row['Number and Operations Scale Score']) : null,
      algebra_and_algebraic_thinking_score: subject === 'MATH' ? parseNumber(row['Algebra and Algebraic Thinking Scale Score']) : null,
      measurement_and_data_score: subject === 'MATH' ? parseNumber(row['Measurement and Data Scale Score']) : null,
      geometry_score: subject === 'MATH' ? parseNumber(row['Geometry Scale Score']) : null,
      
      // Common fields
      lessons_passed: 0, // Not in CSV, set to 0
      lessons_attempted: 0, // Not in CSV, set to 0 
      time_on_task_minutes: parseNumber(row['Duration (min)']),
      teacher_id: null, // Will be populated later if needed
      teacher_name: row['Class Teacher(s)'] || null,
      csv_file_source: csvSource,
      import_batch_id: this.importBatchId,
      data_quality_score: 1,
      academic_year_int: ACADEMIC_YEAR_MAPPING[schoolYear] || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  /**
   * Insert records in batches with upsert to handle duplicates
   */
  async insertRecords(records, batchSize = 500) {
    console.log(`📤 Inserting ${records.length} records in batches of ${batchSize}...`);
    
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      
      try {
        const { data, error } = await supabase
          .from('iready_diagnostic_results')
          .insert(batch);
          
        if (error) {
          console.error(`❌ Error inserting batch ${Math.floor(i/batchSize) + 1}:`, error);
          this.errors.push(`Batch ${Math.floor(i/batchSize) + 1}: ${error.message}`);
          this.stats.errors += batch.length;
        } else {
          console.log(`✅ Inserted batch ${Math.floor(i/batchSize) + 1} (${batch.length} records)`);
          this.stats.recordsInserted += batch.length;
        }
      } catch (err) {
        console.error(`❌ Exception inserting batch ${Math.floor(i/batchSize) + 1}:`, err);
        this.errors.push(`Batch ${Math.floor(i/batchSize) + 1}: ${err.message}`);
        this.stats.errors += batch.length;
      }
    }
  }

  /**
   * Process a single CSV file
   */
  async processFile(filePath, subject, schoolYear) {
    console.log(`\n🔄 Processing ${path.basename(filePath)}...`);
    
    try {
      const csvRecords = await this.parseCSV(filePath);
      const csvSource = path.relative(path.join(__dirname, 'References'), filePath);
      
      const transformedRecords = csvRecords.map(row => 
        this.transformRecord(row, subject, schoolYear, csvSource)
      ).filter(record => record.aeries_student_id); // Filter out records without student ID
      
      console.log(`🔧 Transformed ${transformedRecords.length} valid records`);
      
      if (transformedRecords.length > 0) {
        await this.insertRecords(transformedRecords);
      }
      
      this.stats.filesProcessed++;
      this.stats.recordsProcessed += csvRecords.length;
      
    } catch (error) {
      console.error(`❌ Error processing ${filePath}:`, error);
      this.errors.push(`File ${filePath}: ${error.message}`);
    }
  }

  /**
   * Clear existing data (optional)
   */
  async clearExistingData() {
    console.log('🗑️ Clearing existing iReady data...');
    
    const { error } = await supabase
      .from('iready_diagnostic_results')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records
      
    if (error) {
      console.error('❌ Error clearing data:', error);
      throw error;
    }
    
    console.log('✅ Existing data cleared');
  }

  /**
   * Main execution function
   */
  async run(clearData = false) {
    console.log(`🚀 Starting iReady data reload (Batch ID: ${this.importBatchId})`);
    console.log(`📁 Working directory: ${__dirname}`);
    
    try {
      // Clear existing data if requested
      if (clearData) {
        await this.clearExistingData();
      }

      const referencesPath = path.join(__dirname, 'References', 'iReady Data');
      
      // Define files to process
      const filesToProcess = [
        // Current Year (2024-2025)
        { folder: 'Current_Year', file: 'diagnostic_results_ela_CONFIDENTIAL.csv', subject: 'ELA', year: '2024-2025' },
        { folder: 'Current_Year', file: 'diagnostic_results_math_CONFIDENTIAL.csv', subject: 'MATH', year: '2024-2025' },
        
        // Previous Year (2023-2024) 
        { folder: 'Current_Year-1', file: 'diagnostic_results_ela_CONFIDENTIAL.csv', subject: 'ELA', year: '2023-2024' },
        { folder: 'Current_Year-1', file: 'diagnostic_results_math_CONFIDENTIAL.csv', subject: 'MATH', year: '2023-2024' },
        
        // Two Years Ago (2022-2023)
        { folder: 'Current_Year-2', file: 'diagnostic_results_ela_CONFIDENTIAL.csv', subject: 'ELA', year: '2022-2023' },
        { folder: 'Current_Year-2', file: 'diagnostic_results_math_CONFIDENTIAL.csv', subject: 'MATH', year: '2022-2023' }
      ];

      // Process each file
      for (const fileInfo of filesToProcess) {
        const filePath = path.join(referencesPath, fileInfo.folder, fileInfo.file);
        
        if (fs.existsSync(filePath)) {
          await this.processFile(filePath, fileInfo.subject, fileInfo.year);
        } else {
          console.log(`⚠️ File not found: ${filePath}`);
          this.errors.push(`File not found: ${filePath}`);
        }
      }

      // Print final summary
      console.log('\n📊 FINAL SUMMARY:');
      console.log(`Files processed: ${this.stats.filesProcessed}`);
      console.log(`CSV records processed: ${this.stats.recordsProcessed}`);
      console.log(`Database records inserted: ${this.stats.recordsInserted}`);
      console.log(`Errors: ${this.stats.errors}`);
      
      if (this.errors.length > 0) {
        console.log('\n❌ ERRORS:');
        this.errors.forEach(error => console.log(`  - ${error}`));
      }
      
      console.log(`\n✅ iReady data reload completed! Batch ID: ${this.importBatchId}`);
      
    } catch (error) {
      console.error('❌ Fatal error during reload:', error);
      throw error;
    }
  }
}

// Execute if run directly
if (require.main === module) {
  const loader = new IReadyDataLoader();
  
  // Get command line arguments
  const clearData = process.argv.includes('--clear');
  
  if (clearData) {
    console.log('🗑️ Will clear existing data before loading');
  }
  
  loader.run(clearData)
    .then(() => {
      console.log('🎉 Script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = IReadyDataLoader;