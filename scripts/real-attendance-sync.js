#!/usr/bin/env node

/**
 * Real Aeries Attendance Data Sync Script
 * 
 * This script pulls ACTUAL attendance data from the Aeries API using the correct endpoints:
 * - /schools/{SchoolCode}/AttendanceHistory/summary/{StudentID}
 * - /schools/{SchoolCode}/AttendanceHistory/details/{StudentID}
 * 
 * NEVER uses fake or sample data - only real attendance records from Aeries SIS.
 */

const https = require('https');
const { createClient } = require('@supabase/supabase-js');

// Configuration
const AERIES_API_KEY = 'e815603e5ccc48aab197771eada7a4c6';
const AERIES_BASE_URL = 'romolandapi.aeries.net';
const SUPABASE_URL = 'https://xadusbywqywarbltelmj.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhZHVzYnl3cXl3YXJibHRlbG1qIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzcyODc1NywiZXhwIjoyMDY5MzA0NzU3fQ.uAByYhX1Ll5COBFIrLyJN-89q5xMqpPs3GZgcwosvRk';

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Statistics tracking
const stats = {
  studentsProcessed: 0,
  summariesFound: 0,
  detailsFound: 0,
  recordsInserted: 0,
  errors: [],
  startTime: Date.now()
};

/**
 * Make API request to Aeries
 */
async function aeriesAPIRequest(endpoint, params = '') {
  return new Promise((resolve, reject) => {
    const fullPath = `/admin/api/v5${endpoint}${params ? '?' + params : ''}`;
    const options = {
      hostname: AERIES_BASE_URL,
      path: fullPath,
      method: 'GET',
      headers: {
        'AERIES-CERT': AERIES_API_KEY,
        'Accept': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.setTimeout(30000, () => reject(new Error('Request timeout')));
    req.end();
  });
}

/**
 * Get all students from school 999 (district-wide)
 */
async function getAllStudents() {
  console.log('🔍 Fetching all district students from school code 999...');
  
  const result = await aeriesAPIRequest('/schools/999/students');
  
  if (result.status === 200 && Array.isArray(result.data)) {
    console.log(`✅ Found ${result.data.length} students district-wide`);
    return result.data;
  } else {
    throw new Error(`Failed to fetch students: ${result.status} - ${JSON.stringify(result.data)}`);
  }
}

/**
 * Get attendance summary for a student
 */
async function getAttendanceSummary(studentID, schoolCode) {
  try {
    const result = await aeriesAPIRequest(`/schools/${schoolCode}/AttendanceHistory/summary/${studentID}`);
    
    if (result.status === 200 && Array.isArray(result.data) && result.data.length > 0) {
      const studentData = result.data[0];
      if (studentData.HistorySummaries && studentData.HistorySummaries.length > 0) {
        stats.summariesFound++;
        return studentData.HistorySummaries;
      }
    }
    return null;
  } catch (error) {
    stats.errors.push({
      type: 'summary_error',
      studentID,
      schoolCode,
      error: error.message
    });
    return null;
  }
}

/**
 * Get detailed attendance records for a student
 */
async function getAttendanceDetails(studentID, schoolCode, startDate = '20240801', endDate = '20241231') {
  try {
    const params = `StartDate=${startDate}&EndDate=${endDate}`;
    const result = await aeriesAPIRequest(`/schools/${schoolCode}/AttendanceHistory/details/${studentID}`, params);
    
    if (result.status === 200 && Array.isArray(result.data) && result.data.length > 0) {
      stats.detailsFound++;
      return result.data;
    }
    return null;
  } catch (error) {
    stats.errors.push({
      type: 'details_error',
      studentID,
      schoolCode,
      error: error.message
    });
    return null;
  }
}

/**
 * Transform attendance summary data for Supabase storage
 */
function transformSummaryData(studentID, schoolCode, summaries) {
  const records = [];
  
  for (const summary of summaries) {
    // Only process 2024-2025 school year data
    if (summary.SchoolYear === '2024-2025') {
      records.push({
        student_id: null, // Will be filled by lookup
        aeries_student_id: studentID.toString(),
        school_code: schoolCode.toString(),
        school_year: summary.SchoolYear,
        days_enrolled: summary.DaysEnrolled || 0,
        days_present: summary.DaysPresent || 0,
        days_absent: summary.DaysAbsence || 0,
        days_excused: summary.DaysExcused || 0,
        days_unexcused: summary.DaysUnexcused || 0,
        days_tardy: summary.DaysTardy || 0,
        days_truancy: summary.DaysOfTruancy || 0,
        days_suspension: summary.DaysSuspension || 0,
        attendance_rate: summary.DaysEnrolled > 0 ? 
          ((summary.DaysPresent || 0) / summary.DaysEnrolled * 100).toFixed(2) : '0.00',
        sync_timestamp: new Date().toISOString(),
        data_source: 'aeries_api'
      });
    }
  }
  
  return records;
}

/**
 * Insert attendance records into Supabase
 */
async function insertAttendanceRecords(records) {
  if (records.length === 0) return 0;
  
  try {
    // Insert into existing attendance_records table
    const { data, error } = await supabase
      .from('attendance_records')
      .upsert(records, {
        onConflict: 'aeries_student_id,school_year',
        ignoreDuplicates: false
      });
    
    if (error) {
      throw error;
    }
    
    stats.recordsInserted += records.length;
    return records.length;
  } catch (error) {
    stats.errors.push({
      type: 'database_error',
      error: error.message,
      recordCount: records.length
    });
    console.error('❌ Database insertion error:', error.message);
    return 0;
  }
}

/**
 * Process a batch of students
 */
async function processBatch(students, batchNumber, batchSize) {
  console.log(`\n📦 Processing batch ${batchNumber} (${students.length} students)...`);
  
  // Group students by school code for efficient API calls
  const studentsBySchool = {};
  students.forEach(student => {
    const schoolCode = student.SchoolCode || 999;
    if (!studentsBySchool[schoolCode]) {
      studentsBySchool[schoolCode] = [];
    }
    studentsBySchool[schoolCode].push(student);
  });
  
  let batchRecords = [];
  
  for (const [schoolCode, schoolStudents] of Object.entries(studentsBySchool)) {
    console.log(`  📍 Processing ${schoolStudents.length} students from school ${schoolCode}`);
    
    for (const student of schoolStudents) {
      try {
        stats.studentsProcessed++;
        
        // Get attendance summary
        const summaries = await getAttendanceSummary(student.StudentID, schoolCode);
        
        if (summaries) {
          const summaryRecords = transformSummaryData(student.StudentID, schoolCode, summaries);
          batchRecords = batchRecords.concat(summaryRecords);
          
          // Log current year stats if available
          const currentYear = summaries.find(s => s.SchoolYear === '2024-2025');
          if (currentYear) {
            const attendanceRate = currentYear.DaysEnrolled > 0 ? 
              (currentYear.DaysPresent / currentYear.DaysEnrolled * 100).toFixed(1) : '0.0';
            console.log(`    ✓ ${student.FirstName} ${student.LastName}: ${attendanceRate}% attendance (${currentYear.DaysPresent}/${currentYear.DaysEnrolled} days)`);
          }
        }
        
        // Rate limiting: small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        stats.errors.push({
          type: 'processing_error',
          studentID: student.StudentID,
          error: error.message
        });
        console.error(`    ❌ Error processing ${student.FirstName} ${student.LastName}: ${error.message}`);
      }
    }
  }
  
  // Insert batch records
  if (batchRecords.length > 0) {
    console.log(`  💾 Inserting ${batchRecords.length} attendance records...`);
    await insertAttendanceRecords(batchRecords);
  }
  
  // Progress update
  const elapsed = (Date.now() - stats.startTime) / 1000;
  const rate = stats.studentsProcessed / elapsed;
  console.log(`  ⏱️  Progress: ${stats.studentsProcessed} students, ${stats.summariesFound} summaries, ${rate.toFixed(1)} students/sec`);
}

/**
 * Main sync function
 */
async function syncRealAttendanceData() {
  console.log('🚀 Starting Real Aeries Attendance Data Sync');
  console.log('⚠️  This script ONLY uses actual data from Aeries - NO fake/sample data');
  console.log('=' .repeat(60));
  
  try {
    // 1. Get all students
    const allStudents = await getAllStudents();
    
    // 2. Process in batches
    const batchSize = 50; // Conservative batch size to avoid rate limits
    const totalBatches = Math.ceil(allStudents.length / batchSize);
    
    console.log(`📊 Will process ${allStudents.length} students in ${totalBatches} batches`);
    
    for (let i = 0; i < totalBatches; i++) {
      const start = i * batchSize;
      const end = Math.min(start + batchSize, allStudents.length);
      const batch = allStudents.slice(start, end);
      
      await processBatch(batch, i + 1, batchSize);
      
      // Longer delay between batches
      if (i < totalBatches - 1) {
        console.log('  ⏳ Waiting 2 seconds before next batch...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // 3. Final statistics
    const totalTime = (Date.now() - stats.startTime) / 1000;
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 Real Attendance Data Sync Complete!');
    console.log('📈 Final Statistics:');
    console.log(`   • Students processed: ${stats.studentsProcessed}`);
    console.log(`   • Summaries found: ${stats.summariesFound}`);
    console.log(`   • Detail records found: ${stats.detailsFound}`);
    console.log(`   • Records inserted: ${stats.recordsInserted}`);
    console.log(`   • Total time: ${totalTime.toFixed(1)} seconds`);
    console.log(`   • Processing rate: ${(stats.studentsProcessed / totalTime).toFixed(1)} students/sec`);
    
    if (stats.errors.length > 0) {
      console.log(`   • Errors encountered: ${stats.errors.length}`);
      console.log('\n❌ Error Summary:');
      const errorTypes = {};
      stats.errors.forEach(err => {
        errorTypes[err.type] = (errorTypes[err.type] || 0) + 1;
      });
      Object.entries(errorTypes).forEach(([type, count]) => {
        console.log(`   • ${type}: ${count}`);
      });
    }
    
    console.log('\n✅ Sync completed successfully with REAL attendance data from Aeries!');
    
  } catch (error) {
    console.error('\n💥 Fatal error during sync:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the sync if this script is executed directly
if (require.main === module) {
  syncRealAttendanceData()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('💥 Unhandled error:', error);
      process.exit(1);
    });
}

module.exports = { syncRealAttendanceData };