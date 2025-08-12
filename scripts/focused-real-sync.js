#!/usr/bin/env node

/**
 * Focused Real Attendance Data Sync
 * 
 * This script syncs a smaller batch of real attendance data from Aeries API
 * with detailed error logging to ensure database insertions work.
 */

const https = require('https');
const { createClient } = require('@supabase/supabase-js');

// Configuration
const AERIES_API_KEY = 'e815603e5ccc48aab197771eeda7a4c6';
const AERIES_BASE_URL = 'romolandapi.aeries.net';
const SUPABASE_URL = 'https://xadusbywqywarbltelmj.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhZHVzYnl3cXl3YXJibHRlbG1qIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzcyODc1NywiZXhwIjoyMDY5MzA0NzU3fQ.uAByYhX1Ll5COBFIrLyJN-89q5xMqpPs3GZgcwosvRk';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const stats = {
  studentsProcessed: 0,
  attendanceFound: 0,
  recordsInserted: 0,
  errors: []
};

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

async function insertAttendanceRecord(record) {
  try {
    console.log(`   💾 Inserting record for student ${record.aeries_student_id}...`);
    
    const { data, error } = await supabase
      .from('attendance_records')
      .insert([record]);
    
    if (error) {
      console.log(`   ❌ Insert failed: ${error.message}`);
      console.log(`   📋 Error code: ${error.code}`);
      console.log(`   📋 Error details: ${error.details || 'N/A'}`);
      stats.errors.push({
        type: 'database_insert',
        studentId: record.aeries_student_id,
        error: error.message,
        code: error.code
      });
      return false;
    } else {
      console.log(`   ✅ Successfully inserted record`);
      stats.recordsInserted++;
      return true;
    }
  } catch (err) {
    console.log(`   ❌ Exception during insert: ${err.message}`);
    stats.errors.push({
      type: 'database_exception',
      studentId: record.aeries_student_id,
      error: err.message
    });
    return false;
  }
}

async function processStudentAttendance(student, schoolCode) {
  console.log(`\n👤 Processing: ${student.FirstName} ${student.LastName} (ID: ${student.StudentID})`);
  stats.studentsProcessed++;
  
  try {
    // Get attendance summary from the specific school
    const summaryResult = await aeriesAPIRequest(`/schools/${schoolCode}/AttendanceHistory/summary/${student.StudentID}`);
    
    if (summaryResult.status === 401) {
      console.log('   ❌ Authentication error - API key may be exhausted');
      throw new Error('API Authentication failed');
    }
    
    if (summaryResult.status !== 200) {
      console.log(`   ⚠️  API returned status ${summaryResult.status}`);
      return false;
    }
    
    if (!Array.isArray(summaryResult.data) || summaryResult.data.length === 0) {
      console.log('   ⚠️  No attendance data returned');
      return false;
    }
    
    const studentData = summaryResult.data[0];
    if (!studentData.HistorySummaries || studentData.HistorySummaries.length === 0) {
      console.log('   ⚠️  No attendance summaries found');
      return false;
    }
    
    // Find 2024-2025 school year data
    const currentYear = studentData.HistorySummaries.find(h => h.SchoolYear === '2024-2025');
    if (!currentYear) {
      console.log('   ⚠️  No 2024-2025 data found');
      return false;
    }
    
    stats.attendanceFound++;
    
    // Calculate attendance rate
    const attendanceRate = currentYear.DaysEnrolled > 0 ? 
      ((currentYear.DaysPresent / currentYear.DaysEnrolled) * 100).toFixed(2) : '0.00';
    
    console.log(`   📊 Found real data: ${attendanceRate}% attendance (${currentYear.DaysPresent}/${currentYear.DaysEnrolled} days)`);
    console.log(`   📊 Absences: ${currentYear.DaysAbsence}, Tardies: ${currentYear.DaysTardy}`);
    
    // Create record for database
    const record = {
      aeries_student_id: student.StudentID.toString(),
      school_code: schoolCode.toString(),
      school_year: currentYear.SchoolYear,
      days_enrolled: currentYear.DaysEnrolled || 0,
      days_present: currentYear.DaysPresent || 0,
      days_absent: currentYear.DaysAbsence || 0,
      days_excused: currentYear.DaysExcused || 0,
      days_unexcused: currentYear.DaysUnexcused || 0,  
      days_tardy: currentYear.DaysTardy || 0,
      days_truancy: currentYear.DaysOfTruancy || 0,
      days_suspension: currentYear.DaysSuspension || 0,
      attendance_rate: parseFloat(attendanceRate),
      sync_timestamp: new Date().toISOString(),
      data_source: 'focused_sync'
    };
    
    // Insert the record
    const inserted = await insertAttendanceRecord(record);
    
    if (inserted) {
      // Verify the record was actually saved
      const { data: verifyData, error: verifyError } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('aeries_student_id', student.StudentID.toString())
        .eq('school_year', '2024-2025');
        
      if (verifyError) {
        console.log(`   ❌ Verification failed: ${verifyError.message}`);
      } else if (verifyData && verifyData.length > 0) {
        console.log(`   ✅ Verification successful - record exists in database`);
      } else {
        console.log(`   ❌ Verification failed - record not found in database`);
      }
    }
    
    return inserted;
    
  } catch (error) {
    console.log(`   ❌ Error processing student: ${error.message}`);
    stats.errors.push({
      type: 'student_processing',
      studentId: student.StudentID,
      error: error.message
    });
    return false;
  }
}

async function focusedSync() {
  console.log('🚀 FOCUSED REAL ATTENDANCE DATA SYNC');
  console.log('⚠️  NO FAKE DATA - ONLY REAL AERIES RECORDS');
  console.log('🎯 Syncing small batch with detailed error tracking');
  console.log('='.repeat(60));
  
  try {
    // Focus on schools that we know have good data: 120, 160, 235
    const testSchools = [120, 160, 235];
    
    for (const schoolCode of testSchools) {
      console.log(`\n🏫 Processing School ${schoolCode}...`);
      
      // Get students from this school
      const studentsResult = await aeriesAPIRequest(`/schools/${schoolCode}/students`);
      
      if (studentsResult.status === 401) {
        console.log('❌ API Authentication failed - stopping sync');
        break;
      }
      
      if (studentsResult.status !== 200 || !Array.isArray(studentsResult.data)) {
        console.log(`❌ Failed to get students from school ${schoolCode}`);
        console.log(`Status: ${studentsResult.status}`);
        continue;
      }
      
      console.log(`📊 Found ${studentsResult.data.length} students in school ${schoolCode}`);
      
      // Process first 5 students from this school
      const studentsToProcess = studentsResult.data.slice(0, 5);
      
      for (const student of studentsToProcess) {
        await processStudentAttendance(student, schoolCode);
        
        // Small delay between students
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Break after first successful school to avoid rate limits
      if (stats.recordsInserted > 0) {
        console.log(`\n✅ Successfully inserted ${stats.recordsInserted} records from school ${schoolCode}`);
        break;
      }
    }
    
    // Final statistics
    console.log('\n' + '='.repeat(60));
    console.log('🎉 FOCUSED SYNC COMPLETE');
    console.log(`📈 Statistics:`);
    console.log(`   • Students processed: ${stats.studentsProcessed}`);
    console.log(`   • Attendance data found: ${stats.attendanceFound}`);
    console.log(`   • Records inserted: ${stats.recordsInserted}`);
    console.log(`   • Errors encountered: ${stats.errors.length}`);
    
    if (stats.errors.length > 0) {
      console.log('\n❌ Errors:');
      stats.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error.type}: ${error.error}`);
      });
    }
    
    if (stats.recordsInserted > 0) {
      console.log('\n✅ SUCCESS! Real attendance data has been synced to Supabase!');
      
      // Show final database count
      const { count } = await supabase
        .from('attendance_records')
        .select('*', { count: 'exact', head: true });
        
      console.log(`📊 Total records now in database: ${count}`);
    } else {
      console.log('\n❌ No records were successfully inserted');
    }
    
  } catch (error) {
    console.error('\n💥 Fatal error:', error.message);
    process.exit(1);
  }
}

// Run the focused sync
focusedSync()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
  });