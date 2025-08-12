#!/usr/bin/env node

/**
 * Simple iReady Data Upload - Single File Processing
 * 
 * This script processes one iReady CSV file at a time for better control
 * and error handling. Designed for large datasets with proper ID resolution.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '../ap-tool-v1/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

class SimpleIReadyUploader {
  constructor() {
    this.batchSize = 25; // Smaller batches for stability
    this.processedCount = 0;
    this.successCount = 0;
    this.errorCount = 0;
    this.studentMatches = 0;
    this.teacherMatches = 0;
  }

  async processAllFiles() {
    console.log('📊 SIMPLE IREADY UPLOAD - PROCESSING ALL FILES');
    console.log('='.repeat(60));

    const files = [
      { path: 'Current_Year/diagnostic_results_ela_CONFIDENTIAL.csv', year: 2024, schoolYear: '2024-2025', subject: 'ELA' },
      { path: 'Current_Year/diagnostic_results_math_CONFIDENTIAL.csv', year: 2024, schoolYear: '2024-2025', subject: 'MATH' },
      { path: 'Current_Year-1/diagnostic_results_ela_CONFIDENTIAL.csv', year: 2023, schoolYear: '2023-2024', subject: 'ELA' },
      { path: 'Current_Year-1/diagnostic_results_math_CONFIDENTIAL.csv', year: 2023, schoolYear: '2023-2024', subject: 'MATH' },
      { path: 'Current_Year-2/diagnostic_results_ela_CONFIDENTIAL.csv', year: 2022, schoolYear: '2022-2023', subject: 'ELA' },
      { path: 'Current_Year-2/diagnostic_results_math_CONFIDENTIAL.csv', year: 2022, schoolYear: '2022-2023', subject: 'MATH' }
    ];

    const baseDir = path.join(__dirname, '..', 'References', 'iReady Data');

    for (const file of files) {
      const fullPath = path.join(baseDir, file.path);
      console.log(`\n📄 Processing: ${file.path}`);
      console.log(`   📅 Year: ${file.schoolYear} (${file.year})`);
      console.log(`   📚 Subject: ${file.subject}`);

      if (!fs.existsSync(fullPath)) {
        console.log('   ❌ File not found, skipping');
        continue;
      }

      const fileSize = fs.statSync(fullPath).size;
      console.log(`   📊 File size: ${Math.round(fileSize / 1024 / 1024 * 100) / 100} MB`);

      await this.processSingleFile(fullPath, file);
    }

    this.displayOverallResults();
  }

  async processSingleFile(filePath, fileConfig) {
    try {
      const csvData = fs.readFileSync(filePath, 'utf-8');
      const records = this.parseCSV(csvData, fileConfig.subject);
      
      console.log(`   📋 Parsed ${records.length} records`);

      if (records.length === 0) {
        console.log('   ⚠️  No records to process');
        return;
      }

      // Process records in small batches
      let batchNumber = 1;
      const totalBatches = Math.ceil(records.length / this.batchSize);

      for (let i = 0; i < records.length; i += this.batchSize) {
        const batch = records.slice(i, i + this.batchSize);
        const progress = Math.round((i / records.length) * 100);

        process.stdout.write(`\r   ⚙️  Batch ${batchNumber}/${totalBatches} (${progress}%) - Processing...`);

        try {
          await this.processBatch(batch, fileConfig);
          batchNumber++;
          
          // Small delay to prevent overwhelming the database
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.log(`\n   ❌ Batch ${batchNumber} failed: ${error.message}`);
          this.errorCount += batch.length;
        }
      }

      console.log(`\n   ✅ File completed: ${this.successCount} successful, ${this.errorCount} errors`);

    } catch (error) {
      console.log(`   ❌ File processing failed: ${error.message}`);
    }
  }

  async processBatch(records, fileConfig) {
    // Convert records to database format
    const dbRecords = records.map(record => 
      this.convertToDbFormat(record, fileConfig)
    ).filter(record => record !== null);

    if (dbRecords.length === 0) return;

    // Enrich with student/teacher IDs
    const enrichedRecords = await this.enrichWithIds(dbRecords);

    // Remove duplicates within batch
    const uniqueRecords = this.removeDuplicates(enrichedRecords);

    // Insert to database
    if (uniqueRecords.length > 0) {
      const { error } = await supabase
        .from('iready_diagnostic_results')
        .upsert(uniqueRecords, {
          onConflict: 'district_student_id,subject,academic_year_int,diagnostic_date'
        });

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      this.successCount += uniqueRecords.length;
      this.processedCount += uniqueRecords.length;
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
        // Skip malformed rows
        continue;
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
      const studentId = record['Student ID'] || '';
      const firstName = record['First Name'] || '';
      const lastName = record['Last Name'] || '';
      const studentName = `${firstName} ${lastName}`.trim();
      const grade = parseInt(record['Student Grade']) || 0;
      const overallScaleScore = parseInt(record['Overall Scale Score']) || 0;
      const overallPlacement = record['Overall Placement'] || '';
      const completionDate = record['Completion Date'] || '';
      const teacherName = record['Class Teacher(s)'] || '';

      // Basic validation
      if (!studentId || !studentName || overallScaleScore < 100 || overallScaleScore > 800) {
        return null;
      }

      const baseRecord = {
        studentId,
        studentName,
        grade,
        subject,
        overallScaleScore,
        overallPlacement,
        diagnosticDate: completionDate,
        teacherName: teacherName.replace(/"/g, ''),
        lessonsPassed: 0,
        lessonsAttempted: 0,
        timeOnTaskMinutes: parseInt(record['Duration (min)']) || 0
      };

      // Subject-specific fields
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
      return null;
    }
  }

  convertToDbFormat(record, fileConfig) {
    return {
      district_student_id: record.studentId,
      student_name: record.studentName,
      student_id: null, // Will be resolved
      academic_year_int: fileConfig.year,
      school_year: fileConfig.schoolYear,
      subject: record.subject,
      diagnostic_date: this.formatDate(record.diagnosticDate),
      grade_level: record.grade,
      overall_scale_score: record.overallScaleScore,
      overall_placement: this.mapPlacement(record.overallPlacement),
      
      // ELA fields
      phonological_awareness_score: record.phonologicalAwarenessScore,
      phonics_score: record.phonicsScore,
      high_frequency_words_score: record.highFrequencyWordsScore,
      vocabulary_score: record.vocabScore,
      literary_comprehension_score: record.literaryComprehensionScore,
      informational_comprehension_score: record.informationalComprehensionScore,
      
      // Math fields
      number_and_operations_score: record.numberOperationsScore,
      algebra_and_algebraic_thinking_score: record.algebraScore,
      measurement_and_data_score: record.measurementDataScore,
      geometry_score: record.geometryScore,
      
      // Performance indicators
      lessons_passed: record.lessonsPassed,
      lessons_attempted: record.lessonsAttempted,
      time_on_task_minutes: record.timeOnTaskMinutes,
      
      // Teacher info
      teacher_name: record.teacherName,
      teacher_id: null, // Will be resolved
      
      // Metadata
      csv_file_source: fileConfig.path,
      import_batch_id: this.generateUUID(),
      data_quality_score: 1.0
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
          this.studentMatches++;
        }
      } catch (error) {
        // Student not found - keep as null
      }

      // Resolve teacher_id (simplified)
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
              this.teacherMatches++;
            }
          }
        } catch (error) {
          // Teacher not found - keep as null
        }
      }

      enrichedRecords.push(enrichedRecord);
    }

    return enrichedRecords;
  }

  removeDuplicates(records) {
    const uniqueMap = new Map();
    
    records.forEach(record => {
      const key = `${record.district_student_id}|${record.subject}|${record.academic_year_int}|${record.diagnostic_date}`;
      uniqueMap.set(key, record);
    });
    
    return Array.from(uniqueMap.values());
  }

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

  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  displayOverallResults() {
    console.log('\n' + '='.repeat(60));
    console.log('🎉 SIMPLE IREADY UPLOAD COMPLETE!');
    console.log('='.repeat(60));
    console.log(`📊 Total Records Processed: ${this.processedCount}`);
    console.log(`✅ Successfully Uploaded: ${this.successCount}`);
    console.log(`❌ Failed Records: ${this.errorCount}`);
    console.log(`🔗 Students Matched: ${this.studentMatches}`);
    console.log(`👨‍🏫 Teachers Matched: ${this.teacherMatches}`);
    
    const successRate = this.processedCount > 0 ? Math.round((this.successCount / this.processedCount) * 100) : 0;
    console.log(`📈 Success Rate: ${successRate}%`);
    console.log('='.repeat(60));
  }
}

async function main() {
  try {
    const uploader = new SimpleIReadyUploader();
    await uploader.processAllFiles();
  } catch (error) {
    console.error('💥 Upload process failed:', error);
    process.exit(1);
  }
}

main();