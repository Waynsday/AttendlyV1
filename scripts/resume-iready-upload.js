#!/usr/bin/env node

/**
 * Resume iReady Data Upload Script
 * 
 * This script resumes the iReady data upload from where it left off,
 * skipping already processed records and handling duplicates gracefully.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '../ap-tool-v1/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Import the main uploader class
const originalLog = console.log;
console.log = (...args) => {}; // Temporarily disable logs to import
const { IReadyDataUploader } = require('./upload-iready-data.js');
console.log = originalLog; // Restore logs

class ResumeIReadyUploader extends IReadyDataUploader {
  constructor() {
    super();
    this.skipExisting = true;
    this.existingRecords = new Set();
  }

  async resumeUpload() {
    console.log('🔄 RESUMING IREADY DATA UPLOAD');
    console.log('='.repeat(50));
    console.log(`🆔 Batch ID: ${this.batchId}`);
    console.log(`📅 Resumed: ${new Date().toISOString()}`);
    console.log('='.repeat(50));

    try {
      // Load existing records to avoid duplicates
      await this.loadExistingRecords();
      
      // Continue with the upload process
      await this.uploadAllData();
      
    } catch (error) {
      console.error('❌ Resume failed:', error.message);
      throw error;
    }
  }

  async loadExistingRecords() {
    console.log('\n📋 Loading existing records to avoid duplicates...');
    
    try {
      const { data: existing } = await supabase
        .from('iready_diagnostic_results')
        .select('district_student_id, subject, academic_year_int, diagnostic_date');

      if (existing) {
        existing.forEach(record => {
          const key = `${record.district_student_id}|${record.subject}|${record.academic_year_int}|${record.diagnostic_date}`;
          this.existingRecords.add(key);
        });
        
        console.log(`   ✅ Loaded ${existing.length} existing records for duplicate checking`);
      }
    } catch (error) {
      console.log(`   ⚠️  Could not load existing records: ${error.message}`);
      console.log('   📝 Continuing with upsert handling...');
    }
  }

  processRecord(record, subject) {
    // Call parent method
    const processedRecord = super.processRecord(record, subject);
    
    if (!processedRecord) return null;

    // Check if record already exists (optional optimization)
    if (this.skipExisting && this.existingRecords.size > 0) {
      const key = `${processedRecord.studentId}|${subject}|CURRENT_YEAR|${processedRecord.diagnosticDate}`;
      if (this.existingRecords.has(key)) {
        // Skip this record silently
        return null;
      }
    }

    return processedRecord;
  }

  async processYearFolder(dataDirectory, yearFolder) {
    console.log(`\n📚 Resuming ${yearFolder}...`);
    
    // Check what's already been processed for this year
    const academicYearConfig = {
      'Current_Year': { enum: 'CURRENT_YEAR', schoolYear: '2024-2025' },
      'Current_Year-1': { enum: 'CURRENT_YEAR_MINUS_1', schoolYear: '2023-2024' }, 
      'Current_Year-2': { enum: 'CURRENT_YEAR_MINUS_2', schoolYear: '2022-2023' }
    }[yearFolder];

    if (!academicYearConfig) {
      console.log(`   ⚠️  Unknown year folder: ${yearFolder}, skipping`);
      return;
    }

    // Check current progress for this year
    const { count: existingCount } = await supabase
      .from('iready_diagnostic_results')
      .select('*', { count: 'exact', head: true })
      .eq('academic_year_int', academicYearConfig.year);

    console.log(`   📊 Found ${existingCount || 0} existing records for ${academicYearConfig.schoolYear}`);

    // Continue with parent implementation
    return super.processYearFolder(dataDirectory, yearFolder);
  }

  displayFinalResults() {
    // Enhanced final results
    super.displayFinalResults();
    
    console.log('\n🔄 RESUME OPERATION DETAILS:');
    console.log(`   📋 Existing records loaded: ${this.existingRecords.size}`);
    console.log(`   🔄 Duplicate checking: ${this.skipExisting ? 'ENABLED' : 'DISABLED'}`);
  }
}

async function main() {
  try {
    const uploader = new ResumeIReadyUploader();
    await uploader.resumeUpload();
  } catch (error) {
    console.error('💥 Resume process failed:', error);
    process.exit(1);
  }
}

// Only run if called directly
if (require.main === module) {
  main();
}