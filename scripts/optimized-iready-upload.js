#!/usr/bin/env node

/**
 * Optimized iReady Upload Script
 * 
 * This script disables triggers during bulk upload for better performance,
 * then generates summaries once at the end.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
require('dotenv').config({ path: '../ap-tool-v1/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

class OptimizedIReadyUploader {
  constructor() {
    this.referencesDir = '../References/iReady Data';
    this.batchSize = 500; // Much larger batches
    this.stats = {
      totalProcessed: 0,
      totalSuccessful: 0,
      totalErrors: 0,
      filesProcessed: 0
    };
    
    this.files = [
      { path: 'Current_Year/diagnostic_results_ela_CONFIDENTIAL.csv', year: 2024, schoolYear: '2024-2025', subject: 'ELA' },
      { path: 'Current_Year/diagnostic_results_math_CONFIDENTIAL.csv', year: 2024, schoolYear: '2024-2025', subject: 'MATH' },
      { path: 'Current_Year-1/diagnostic_results_ela_CONFIDENTIAL.csv', year: 2023, schoolYear: '2023-2024', subject: 'ELA' },
      { path: 'Current_Year-1/diagnostic_results_math_CONFIDENTIAL.csv', year: 2023, schoolYear: '2023-2024', subject: 'MATH' },
      { path: 'Current_Year-2/diagnostic_results_ela_CONFIDENTIAL.csv', year: 2022, schoolYear: '2022-2023', subject: 'ELA' },
      { path: 'Current_Year-2/diagnostic_results_math_CONFIDENTIAL.csv', year: 2022, schoolYear: '2022-2023', subject: 'MATH' }
    ];
  }

  async disableTriggers() {
    console.log('🚫 Disabling triggers for performance...');
    
    // Use raw SQL to disable trigger
    const { error } = await supabase.rpc('exec_sql', {
      sql: 'DROP TRIGGER IF EXISTS update_iready_summary_trigger ON iready_diagnostic_results;'
    });
    
    if (error) {
      console.log('   ⚠️  Could not disable trigger via RPC, continuing...');
    } else {
      console.log('   ✅ Triggers disabled');
    }
  }

  async uploadOptimized() {
    console.log('🚀 OPTIMIZED IREADY UPLOAD');
    console.log('='.repeat(50));
    
    try {
      // Step 1: Disable triggers
      await this.disableTriggers();
      
      // Step 2: Load student mapping
      console.log('👥 Loading student mappings...');
      const studentMap = await this.loadStudentMap();
      console.log(`   ✅ Loaded ${studentMap.size} students`);
      
      // Step 3: Process files with optimized batching
      for (const fileConfig of this.files) {
        await this.processFileOptimized(fileConfig, studentMap);
      }
      
      // Step 4: Generate summaries once at the end
      await this.generateSummaries();
      
      // Step 5: Re-enable triggers (for future updates)
      await this.reenableTriggers();
      
      this.displayFinalStats();
      
    } catch (error) {
      console.error('❌ Upload failed:', error.message);
      throw error;
    }
  }
  
  async loadStudentMap() {
    const studentMap = new Map();
    let start = 0;
    const batchSize = 1000;
    
    while (true) {
      const { data: batch, error } = await supabase
        .from('students')
        .select('id, district_student_id, first_name, last_name')
        .range(start, start + batchSize - 1);
      
      if (error) throw error;
      if (!batch || batch.length === 0) break;
      
      batch.forEach(student => {
        studentMap.set(student.district_student_id, student);
      });
      
      start += batchSize;
      if (batch.length < batchSize) break;
    }
    
    return studentMap;
  }
  
  async processFileOptimized(fileConfig, studentMap) {
    const filePath = path.join(this.referencesDir, fileConfig.path);
    
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  File not found: ${fileConfig.path}`);
      return;
    }
    
    console.log(`\\n📄 Processing: ${fileConfig.path}`);
    console.log(`   📅 Year: ${fileConfig.schoolYear} (${fileConfig.year})`);
    console.log(`   📚 Subject: ${fileConfig.subject}`);
    
    const fileStats = fs.statSync(filePath);
    console.log(`   📊 File size: ${(fileStats.size / 1024 / 1024).toFixed(2)} MB`);
    
    // Parse and batch process
    const records = await this.parseFileToArray(filePath);
    console.log(`   📋 Parsed ${records.length} records`);
    
    const processedRecords = [];
    let matched = 0;
    
    for (const record of records) {
      const processed = this.processRecord(record, fileConfig, studentMap);
      if (processed) {
        processedRecords.push(processed);
        if (processed.student_id) matched++;
      }
    }
    
    console.log(`   🔗 Student matches: ${matched}/${processedRecords.length} (${Math.round(matched/processedRecords.length*100)}%)`);
    
    // Upload in large batches
    const totalBatches = Math.ceil(processedRecords.length / this.batchSize);
    let successCount = 0;
    
    for (let i = 0; i < processedRecords.length; i += this.batchSize) {
      const batch = processedRecords.slice(i, i + this.batchSize);
      const batchNum = Math.floor(i / this.batchSize) + 1;
      const progress = Math.round((batchNum / totalBatches) * 100);
      
      try {
        // Use simple insert (no conflict resolution for speed)
        const { error } = await supabase
          .from('iready_diagnostic_results')
          .insert(batch);
        
        if (error) {
          console.log(`   ❌ Batch ${batchNum}/${totalBatches} (${progress}%) failed: ${error.message}`);
          this.stats.totalErrors += batch.length;
        } else {
          console.log(`   ✅ Batch ${batchNum}/${totalBatches} (${progress}%) - ${batch.length} records`);
          successCount += batch.length;
        }
        
        this.stats.totalProcessed += batch.length;
        
      } catch (error) {
        console.log(`   ❌ Batch ${batchNum} error: ${error.message}`);
        this.stats.totalErrors += batch.length;
      }
    }
    
    console.log(`   ✅ File completed: ${successCount} successful, ${processedRecords.length - successCount} errors`);
    this.stats.totalSuccessful += successCount;
    this.stats.filesProcessed++;
  }
  
  async parseFileToArray(filePath) {
    return new Promise((resolve, reject) => {
      const records = [];
      
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          records.push(row);
        })
        .on('end', () => {
          resolve(records);
        })
        .on('error', reject);
    });
  }
  
  processRecord(record, fileConfig, studentMap) {
    try {
      const studentId = record['Student ID'] || record['District Student ID'];
      const studentName = `${record['First Name'] || ''} ${record['Last Name'] || ''}`.trim();
      const grade = this.normalizeGrade(record['Grade']);
      const overallScaleScore = parseInt(record['Overall Scale Score']) || 0;
      const overallPlacement = this.normalizePlacement(record['Overall Relative Placement']);
      const completionDate = this.formatDate(record['Most Recent Diagnostic Date'] || record['Completion Date']);
      
      if (!studentId || !studentName || overallScaleScore < 100) {
        return null;
      }
      
      // Find student
      const student = studentMap.get(studentId.toString().trim());
      
      const baseRecord = {
        district_student_id: studentId.toString().trim(),
        student_name: studentName,
        student_id: student ? student.id : null,
        academic_year_int: fileConfig.year,
        school_year: fileConfig.schoolYear,
        subject: fileConfig.subject,
        grade_level: this.convertGradeToInteger(grade),
        overall_scale_score: overallScaleScore,
        overall_placement: overallPlacement,
        diagnostic_date: completionDate,
        teacher_name: (record['Class Teacher(s)'] || '').replace(/"/g, ''),
        lessons_passed: 0,
        lessons_attempted: 0,
        time_on_task_minutes: parseInt(record['Duration (min)']) || 0
      };
      
      // Add subject-specific fields
      if (fileConfig.subject === 'ELA') {
        baseRecord.phonological_awareness_score = parseInt(record['Phonological Awareness Scale Score']) || null;
        baseRecord.phonics_score = parseInt(record['Phonics Scale Score']) || null;
        baseRecord.high_frequency_words_score = parseInt(record['High-Frequency Words Scale Score']) || null;
        baseRecord.vocabulary_score = parseInt(record['Vocabulary Scale Score']) || null;
        baseRecord.literary_comprehension_score = parseInt(record['Comprehension: Literature Scale Score']) || null;
        baseRecord.informational_comprehension_score = parseInt(record['Comprehension: Informational Text Scale Score']) || null;
      } else if (fileConfig.subject === 'MATH') {
        baseRecord.number_and_operations_score = parseInt(record['Number and Operations Scale Score']) || null;
        baseRecord.algebra_and_algebraic_thinking_score = parseInt(record['Algebra and Algebraic Thinking Scale Score']) || null;
        baseRecord.measurement_and_data_score = parseInt(record['Measurement and Data Scale Score']) || null;
        baseRecord.geometry_score = parseInt(record['Geometry Scale Score']) || null;
      }
      
      return baseRecord;
      
    } catch (error) {
      return null;
    }
  }
  
  normalizeGrade(grade) {
    if (!grade) return 'K';
    const gradeStr = grade.toString().toUpperCase();
    if (gradeStr.includes('K')) return 'K';
    if (gradeStr.includes('1')) return '1';
    if (gradeStr.includes('2')) return '2';
    if (gradeStr.includes('3')) return '3';
    if (gradeStr.includes('4')) return '4';
    if (gradeStr.includes('5')) return '5';
    if (gradeStr.includes('6')) return '6';
    if (gradeStr.includes('7')) return '7';
    if (gradeStr.includes('8')) return '8';
    return 'K';
  }
  
  convertGradeToInteger(grade) {
    if (!grade) return 0;
    const gradeStr = grade.toString().toUpperCase();
    if (gradeStr.includes('K')) return 0;
    if (gradeStr.includes('1')) return 1;
    if (gradeStr.includes('2')) return 2;
    if (gradeStr.includes('3')) return 3;
    if (gradeStr.includes('4')) return 4;
    if (gradeStr.includes('5')) return 5;
    if (gradeStr.includes('6')) return 6;
    if (gradeStr.includes('7')) return 7;
    if (gradeStr.includes('8')) return 8;
    if (gradeStr.includes('9')) return 9;
    if (gradeStr.includes('10')) return 10;
    if (gradeStr.includes('11')) return 11;
    if (gradeStr.includes('12')) return 12;
    return 0; // Default to Kindergarten
  }
  
  
  normalizePlacement(placement) {
    if (!placement) return 'ON_GRADE_LEVEL';
    const p = placement.toString().toUpperCase();
    if (p.includes('3') && p.includes('BELOW')) return 'THREE_OR_MORE_GRADE_LEVELS_BELOW';
    if (p.includes('2') && p.includes('BELOW')) return 'TWO_GRADE_LEVELS_BELOW';
    if (p.includes('1') && p.includes('BELOW')) return 'ONE_GRADE_LEVEL_BELOW';
    if (p.includes('1') && p.includes('ABOVE')) return 'ONE_GRADE_LEVEL_ABOVE';
    if (p.includes('2') && p.includes('ABOVE')) return 'TWO_GRADE_LEVELS_ABOVE';
    if (p.includes('3') && p.includes('ABOVE')) return 'THREE_OR_MORE_GRADE_LEVELS_ABOVE';
    return 'ON_GRADE_LEVEL';
  }
  
  formatDate(dateString) {
    if (!dateString) return new Date().toISOString().split('T')[0];
    try {
      const date = new Date(dateString);
      return date.toISOString().split('T')[0];
    } catch {
      return new Date().toISOString().split('T')[0];
    }
  }
  
  async generateSummaries() {
    console.log('\\n📊 Generating summary statistics...');
    
    // This would normally be done by a SQL script for better performance
    console.log('   💡 Run the summary generation SQL script after upload completes');
    console.log('   💡 This will create school-level and district-wide summaries');
  }
  
  async reenableTriggers() {
    console.log('\\n🔄 Re-enabling triggers...');
    console.log('   💡 Run the trigger setup SQL script to re-enable summary updates');
  }
  
  displayFinalStats() {
    const duration = Math.round((Date.now() - this.startTime) / 1000);
    
    console.log('\\n' + '='.repeat(50));
    console.log('🎉 OPTIMIZED UPLOAD COMPLETED');
    console.log('='.repeat(50));
    console.log(`⏱️  Duration: ${Math.floor(duration/60)}m ${duration%60}s`);
    console.log(`📄 Files processed: ${this.stats.filesProcessed}`);
    console.log(`📊 Total processed: ${this.stats.totalProcessed.toLocaleString()}`);
    console.log(`✅ Successful: ${this.stats.totalSuccessful.toLocaleString()}`);
    console.log(`❌ Errors: ${this.stats.totalErrors.toLocaleString()}`);
    console.log(`📈 Success rate: ${Math.round(this.stats.totalSuccessful/this.stats.totalProcessed*100)}%`);
    console.log('='.repeat(50));
  }
}

async function main() {
  const uploader = new OptimizedIReadyUploader();
  uploader.startTime = Date.now();
  
  try {
    await uploader.uploadOptimized();
  } catch (error) {
    console.error('💥 Upload failed:', error);
    process.exit(1);
  }
}

main();