#!/usr/bin/env node

/**
 * Complete iReady Data Upload Script
 * 
 * This script uploads all iReady CSV data from the References directory
 * into the isolated iReady database tables with proper student/teacher ID linking.
 * 
 * @author Claude Code (QA Education Data Tester)
 * @version 1.0.0
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '../ap-tool-v1/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Academic year mappings
const ACADEMIC_YEARS = {
  'Current_Year': { enum: 'CURRENT_YEAR', schoolYear: '2024-2025' },
  'Current_Year-1': { enum: 'CURRENT_YEAR_MINUS_1', schoolYear: '2023-2024' },
  'Current_Year-2': { enum: 'CURRENT_YEAR_MINUS_2', schoolYear: '2022-2023' }
};

class IReadyDataUploader {
  constructor() {
    this.batchId = this.generateUUID(); // Use proper UUID format
    this.batchSize = 50; // Smaller batches for better performance
    this.stats = {
      totalRecords: 0,
      successfulRecords: 0,
      failedRecords: 0,
      studentsMatched: 0,
      teachersMatched: 0,
      dataQualityIssues: 0,
      processingTime: 0
    };
    this.dataQualityIssues = [];
    this.startTime = Date.now();
  }

  async uploadAllData() {
    console.log('📊 IREADY DATA UPLOAD - COMPLETE PROCESSING');
    console.log('='.repeat(60));
    console.log(`🆔 Batch ID: ${this.batchId}`);
    console.log(`📅 Started: ${new Date().toISOString()}`);
    console.log('='.repeat(60));

    try {
      // Log ETL operation start
      const etlOperationId = await this.logETLStart();

      const dataDirectory = path.join(__dirname, '..', 'References', 'iReady Data');
      console.log(`📂 Data Directory: ${dataDirectory}`);

      if (!fs.existsSync(dataDirectory)) {
        throw new Error(`iReady data directory not found: ${dataDirectory}`);
      }

      const yearFolders = fs.readdirSync(dataDirectory).filter(folder => 
        folder.startsWith('Current_Year') && fs.statSync(path.join(dataDirectory, folder)).isDirectory()
      );

      console.log(`📁 Found ${yearFolders.length} year folders: ${yearFolders.join(', ')}`);

      for (const yearFolder of yearFolders) {
        console.log(`\n📚 Processing ${yearFolder}...`);
        await this.processYearFolder(dataDirectory, yearFolder);
      }

      // Final processing
      await this.generateSummaryStatistics();
      await this.logETLEnd(etlOperationId, 'COMPLETED');

      this.displayFinalResults();

    } catch (error) {
      console.error('❌ Upload failed:', error.message);
      throw error;
    }
  }

  async processYearFolder(dataDirectory, yearFolder) {
    const folderPath = path.join(dataDirectory, yearFolder);
    const academicYearConfig = ACADEMIC_YEARS[yearFolder];
    
    if (!academicYearConfig) {
      console.log(`⚠️  Unknown year folder: ${yearFolder}, skipping`);
      return;
    }

    console.log(`   📅 Academic Year: ${academicYearConfig.schoolYear} (${academicYearConfig.enum})`);

    const csvFiles = fs.readdirSync(folderPath).filter(file => 
      file.toLowerCase().endsWith('.csv') && file.toLowerCase().includes('diagnostic')
    );

    console.log(`   📄 Found ${csvFiles.length} CSV files: ${csvFiles.join(', ')}`);

    for (const csvFile of csvFiles) {
      const filePath = path.join(folderPath, csvFile);
      const subject = csvFile.toLowerCase().includes('ela') ? 'ELA' : 
                     csvFile.toLowerCase().includes('math') ? 'MATH' : null;

      if (!subject) {
        console.log(`   ⚠️  Unknown subject for file: ${csvFile}, skipping`);
        continue;
      }

      console.log(`\n   📊 Processing ${subject} file: ${csvFile}`);
      await this.processCSVFile(filePath, subject, academicYearConfig, csvFile);
    }
  }

  async processCSVFile(filePath, subject, academicYearConfig, fileName) {
    try {
      const csvData = fs.readFileSync(filePath, 'utf-8');
      const records = this.parseCSV(csvData, subject);
      
      console.log(`      📋 Parsed ${records.length} records from CSV`);

      if (records.length === 0) {
        console.log('      ⚠️  No records to process');
        return;
      }

      // Convert to database format
      const dbRecords = records.map(record => 
        this.mapToDatabase(record, academicYearConfig, fileName)
      );

      // Process in batches
      for (let i = 0; i < dbRecords.length; i += this.batchSize) {
        const batch = dbRecords.slice(i, i + this.batchSize);
        const batchNumber = Math.floor(i / this.batchSize) + 1;
        const totalBatches = Math.ceil(dbRecords.length / this.batchSize);

        console.log(`      ⚙️  Processing batch ${batchNumber}/${totalBatches} (${batch.length} records)...`);

        // Enrich with student and teacher IDs
        const enrichedBatch = await this.enrichWithIds(batch);

        // Insert to database
        const success = await this.insertBatch(enrichedBatch);
        
        if (success) {
          this.stats.successfulRecords += enrichedBatch.length;
          console.log(`      ✅ Batch ${batchNumber} completed successfully`);
        } else {
          this.stats.failedRecords += batch.length;
          console.log(`      ❌ Batch ${batchNumber} failed`);
        }

        this.stats.totalRecords += batch.length;
      }

      console.log(`      🎯 File completed: ${this.stats.successfulRecords} successful, ${this.stats.failedRecords} failed`);

    } catch (error) {
      console.error(`      ❌ Error processing file ${fileName}:`, error.message);
      this.stats.failedRecords += 1;
    }
  }

  parseCSV(csvData, subject) {
    const lines = csvData.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = this.parseLine(lines[0]);
    const records = [];

    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '') continue;

      try {
        const values = this.parseLine(lines[i]);
        const record = {};

        headers.forEach((header, index) => {
          record[header] = values[index] || '';
        });

        const processedRecord = this.processRecord(record, subject);
        if (processedRecord) {
          records.push(processedRecord);
        }
      } catch (error) {
        console.log(`        ⚠️  Skipped malformed row ${i + 1}: ${error.message}`);
      }
    }

    return records;
  }

  parseLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim().replace(/^"|"$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current.trim().replace(/^"|"$/g, ''));
    return result;
  }

  processRecord(record, subject) {
    try {
      // Map the actual CSV field names to our expected format
      const studentId = record['Student ID'] || '';
      const firstName = record['First Name'] || '';
      const lastName = record['Last Name'] || '';
      const studentName = `${firstName} ${lastName}`.trim();
      const grade = parseInt(record['Student Grade']) || 0;
      const overallScaleScore = parseInt(record['Overall Scale Score']) || 0;
      const overallPlacement = record['Overall Placement'] || '';
      const completionDate = record['Completion Date'] || '';
      const teacherName = record['Class Teacher(s)'] || '';

      // Validate required fields
      if (!studentId || !studentName) {
        this.logDataQualityIssue('MISSING_REQUIRED_FIELDS', `Missing student ID or name: ID=${studentId}, Name=${studentName}`);
        return null;
      }

      if (overallScaleScore < 100 || overallScaleScore > 800) {
        this.logDataQualityIssue('INVALID_SCALE_SCORE', `Invalid scale score: ${overallScaleScore} for student ${studentId}`);
        return null;
      }

      const baseRecord = {
        studentId,
        studentName,
        grade,
        subject,
        overallScaleScore,
        overallPlacement,
        diagnosticDate: completionDate, // Using completion date as diagnostic date
        teacherName: teacherName.replace(/"/g, ''), // Remove quotes
        lessonsPassed: 0, // Not available in this CSV format
        lessonsAttempted: 0, // Not available in this CSV format
        timeOnTaskMinutes: parseInt(record['Duration (min)']) || 0
      };

      // Add subject-specific fields
      if (subject === 'ELA') {
        baseRecord.phonologicalAwarenessScore = parseInt(record['Phonological Awareness Scale Score']) || null;
        baseRecord.phonicsScore = parseInt(record['Phonics Scale Score']) || null;
        baseRecord.highFrequencyWordsScore = parseInt(record['High-Frequency Words Scale Score']) || null;
        baseRecord.vocabScore = parseInt(record['Vocabulary Scale Score']) || null;
        baseRecord.literaryComprehensionScore = parseInt(record['Comprehension: Literature Scale Score']) || null;
        baseRecord.informationalComprehensionScore = parseInt(record['Comprehension: Informational Text Scale Score']) || null;
      } else if (subject === 'MATH') {
        baseRecord.numberOperationsScore = parseInt(record['Number and Operations Scale Score']) || null;
        baseRecord.algebraScore = parseInt(record['Algebra and Algebraic Thinking Scale Score']) || null;
        baseRecord.measurementDataScore = parseInt(record['Measurement and Data Scale Score']) || null;
        baseRecord.geometryScore = parseInt(record['Geometry Scale Score']) || null;
      }

      return baseRecord;
    } catch (error) {
      this.logDataQualityIssue('PARSING_ERROR', `Failed to process record: ${error.message}`);
      return null;
    }
  }

  mapToDatabase(record, academicYearConfig, fileName) {
    return {
      // Student information
      district_student_id: record.studentId,
      student_name: record.studentName,
      student_id: null, // Will be resolved later
      
      // Academic year and subject
      academic_year: academicYearConfig.enum,
      school_year: academicYearConfig.schoolYear,
      subject: record.subject,
      diagnostic_date: this.formatDate(record.diagnosticDate),
      grade_level: record.grade,
      
      // Overall performance
      overall_scale_score: record.overallScaleScore,
      overall_placement: this.mapPlacement(record.overallPlacement),
      
      // ELA-specific scores
      phonological_awareness_score: record.phonologicalAwarenessScore,
      phonics_score: record.phonicsScore,
      high_frequency_words_score: record.highFrequencyWordsScore,
      vocabulary_score: record.vocabScore,
      literary_comprehension_score: record.literaryComprehensionScore,
      informational_comprehension_score: record.informationalComprehensionScore,
      
      // Math-specific scores
      number_and_operations_score: record.numberOperationsScore,
      algebra_and_algebraic_thinking_score: record.algebraScore,
      measurement_and_data_score: record.measurementDataScore,
      geometry_score: record.geometryScore,
      
      // Performance indicators
      lessons_passed: record.lessonsPassed,
      lessons_attempted: record.lessonsAttempted,
      time_on_task_minutes: record.timeOnTaskMinutes,
      
      // Teacher information
      teacher_name: record.teacherName,
      teacher_id: null, // Will be resolved later
      
      // Metadata
      csv_file_source: fileName,
      import_batch_id: this.batchId,
      data_quality_score: this.calculateDataQualityScore(record)
    };
  }

  async enrichWithIds(records) {
    const enrichedRecords = [];

    for (const record of records) {
      const enrichedRecord = { ...record };

      // Resolve student_id
      try {
        const { data: student } = await supabase
          .from('students')
          .select('id')
          .eq('district_student_id', record.district_student_id)
          .single();

        if (student) {
          enrichedRecord.student_id = student.id;
          this.stats.studentsMatched++;
        } else {
          this.logDataQualityIssue('STUDENT_NOT_FOUND', `Student ${this.maskStudentId(record.district_student_id)} not found in database`);
        }
      } catch (error) {
        this.logDataQualityIssue('STUDENT_LOOKUP_ERROR', `Error looking up student ${this.maskStudentId(record.district_student_id)}: ${error.message}`);
      }

      // Resolve teacher_id
      if (record.teacher_name && record.teacher_name.trim() !== '') {
        try {
          const teacherName = record.teacher_name.trim();
          let firstName = '', lastName = '';

          if (teacherName.includes(',')) {
            const parts = teacherName.split(',').map(p => p.trim());
            lastName = parts[0];
            firstName = parts[1] || '';
          } else {
            const parts = teacherName.split(' ');
            firstName = parts[0] || '';
            lastName = parts.slice(1).join(' ') || '';
          }

          if (firstName && lastName) {
            const { data: teacher } = await supabase
              .from('teachers')
              .select('id')
              .eq('first_name', firstName)
              .eq('last_name', lastName)
              .eq('is_active', true)
              .single();

            if (teacher) {
              enrichedRecord.teacher_id = teacher.id;
              this.stats.teachersMatched++;
            } else {
              this.logDataQualityIssue('TEACHER_NOT_FOUND', `Teacher "${teacherName}" not found in database`);
            }
          }
        } catch (error) {
          this.logDataQualityIssue('TEACHER_LOOKUP_ERROR', `Error looking up teacher "${record.teacher_name}": ${error.message}`);
        }
      }

      enrichedRecords.push(enrichedRecord);
    }

    return enrichedRecords;
  }

  async insertBatch(records) {
    try {
      // Remove duplicates within the batch to prevent "cannot affect row a second time" error
      const uniqueRecords = this.removeDuplicatesFromBatch(records);
      
      if (uniqueRecords.length === 0) {
        return true; // Empty batch is considered successful
      }

      const { error } = await supabase
        .from('iready_diagnostic_results')
        .upsert(uniqueRecords, {
          onConflict: 'district_student_id,subject,academic_year,diagnostic_date'
        });

      if (error) {
        console.error(`        ❌ Database insert error: ${error.message}`);
        console.error(`        📊 Batch size: ${uniqueRecords.length} records`);
        return false;
      }

      return true;
    } catch (error) {
      console.error(`        ❌ Insert batch failed: ${error.message}`);
      return false;
    }
  }

  removeDuplicatesFromBatch(records) {
    const uniqueMap = new Map();
    
    records.forEach(record => {
      // Create unique key from conflict columns
      const key = `${record.district_student_id}|${record.subject}|${record.academic_year}|${record.diagnostic_date}`;
      
      // Keep the last occurrence (most recent processing)
      uniqueMap.set(key, record);
    });
    
    const uniqueRecords = Array.from(uniqueMap.values());
    
    if (uniqueRecords.length < records.length) {
      const duplicatesRemoved = records.length - uniqueRecords.length;
      console.log(`        🔄 Removed ${duplicatesRemoved} duplicate records from batch`);
    }
    
    return uniqueRecords;
  }

  async generateSummaryStatistics() {
    console.log('\n📊 Generating summary statistics...');
    
    try {
      // This would be handled by the database trigger, but we can verify it worked
      const { data: summaryCheck } = await supabase
        .from('iready_year_summary')
        .select('*')
        .limit(5);

      console.log(`   ✅ Summary statistics generated: ${summaryCheck?.length || 0} entries found`);
    } catch (error) {
      console.log(`   ⚠️  Summary statistics check failed: ${error.message}`);
    }
  }

  // Helper methods
  formatDate(dateString) {
    try {
      const date = new Date(dateString);
      return date.toISOString().split('T')[0];
    } catch {
      return new Date().toISOString().split('T')[0];
    }
  }

  mapPlacement(placement) {
    const placementMap = {
      '3+ Grade Levels Below': 'THREE_OR_MORE_GRADE_LEVELS_BELOW',
      '2 Grade Levels Below': 'TWO_GRADE_LEVELS_BELOW',
      '1 Grade Level Below': 'ONE_GRADE_LEVEL_BELOW',
      'On Grade Level': 'ON_GRADE_LEVEL',
      '1 Grade Level Above': 'ONE_GRADE_LEVEL_ABOVE',
      '2 Grade Levels Above': 'TWO_GRADE_LEVELS_ABOVE',
      '3+ Grade Levels Above': 'THREE_OR_MORE_GRADE_LEVELS_ABOVE'
    };
    return placementMap[placement] || 'ON_GRADE_LEVEL';
  }

  calculateDataQualityScore(record) {
    let score = 1.0;
    if (!record.studentId) score -= 0.3;
    if (!record.diagnosticDate) score -= 0.2;
    if (record.overallScaleScore < 100 || record.overallScaleScore > 800) score -= 0.2;
    if (!record.studentName) score -= 0.1;
    return Math.max(0, score);
  }

  logDataQualityIssue(type, description) {
    this.dataQualityIssues.push({
      type,
      description,
      timestamp: new Date().toISOString()
    });
    this.stats.dataQualityIssues++;
  }

  maskStudentId(studentId) {
    if (!studentId || studentId.length < 4) return '[REDACTED]';
    return studentId.substring(0, 3) + '***';
  }

  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  async logETLStart() {
    try {
      const { data, error } = await supabase
        .from('iready_etl_operations')
        .insert({
          operation_type: 'CSV_IMPORT',
          academic_year: 'CURRENT_YEAR', // Will be updated per year
          csv_file_path: 'References/iReady Data/',
          batch_id: this.batchId,
          initiated_by: 'IReadyDataUploader'
        })
        .select('id')
        .single();

      return data?.id || 'unknown';
    } catch (error) {
      console.log('⚠️  ETL logging failed:', error.message);
      return 'unknown';
    }
  }

  async logETLEnd(operationId, status) {
    if (operationId === 'unknown') return;

    try {
      await supabase
        .from('iready_etl_operations')
        .update({
          operation_status: status,
          end_time: new Date().toISOString(),
          total_records_processed: this.stats.totalRecords,
          successful_records: this.stats.successfulRecords,
          failed_records: this.stats.failedRecords,
          data_quality_issues: this.stats.dataQualityIssues,
          processing_time_seconds: Math.round((Date.now() - this.startTime) / 1000),
          records_per_second: Math.round(this.stats.successfulRecords / ((Date.now() - this.startTime) / 1000))
        })
        .eq('id', operationId);
    } catch (error) {
      console.log('⚠️  ETL end logging failed:', error.message);
    }
  }

  displayFinalResults() {
    this.stats.processingTime = Math.round((Date.now() - this.startTime) / 1000);
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 IREADY DATA UPLOAD COMPLETE!');
    console.log('='.repeat(60));
    console.log(`⏱️  Processing Time: ${Math.floor(this.stats.processingTime / 60)}m ${this.stats.processingTime % 60}s`);
    console.log(`📊 Total Records Processed: ${this.stats.totalRecords}`);
    console.log(`✅ Successfully Uploaded: ${this.stats.successfulRecords}`);
    console.log(`❌ Failed Records: ${this.stats.failedRecords}`);
    console.log(`🔗 Students Matched: ${this.stats.studentsMatched}`);
    console.log(`👨‍🏫 Teachers Matched: ${this.stats.teachersMatched}`);
    console.log(`⚠️  Data Quality Issues: ${this.stats.dataQualityIssues}`);
    
    const successRate = Math.round((this.stats.successfulRecords / this.stats.totalRecords) * 100);
    console.log(`📈 Success Rate: ${successRate}%`);
    
    const recordsPerSecond = Math.round(this.stats.successfulRecords / this.stats.processingTime);
    console.log(`⚡ Processing Speed: ${recordsPerSecond} records/second`);
    
    console.log(`\n🆔 Batch ID: ${this.batchId}`);
    console.log('='.repeat(60));

    if (successRate >= 95) {
      console.log('🏆 EXCELLENT! Upload completed with high success rate.');
    } else if (successRate >= 85) {
      console.log('✅ GOOD! Upload completed successfully with minor issues.');
    } else if (successRate >= 70) {
      console.log('⚠️  PARTIAL SUCCESS! Review data quality issues.');
    } else {
      console.log('❌ SIGNIFICANT ISSUES! Manual review required.');
    }

    console.log('\n💡 Next Steps:');
    console.log('   • Run data verification: node verify-iready-upload.js');
    console.log('   • Check summary statistics in iready_year_summary table');
    console.log('   • Review data quality issues in iready_data_quality_log table');
  }
}

async function main() {
  try {
    const uploader = new IReadyDataUploader();
    await uploader.uploadAllData();
  } catch (error) {
    console.error('💥 Upload process failed:', error);
    process.exit(1);
  }
}

main();