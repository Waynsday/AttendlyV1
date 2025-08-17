#!/usr/bin/env node

/**
 * Aeries Attendance Sync - Pull all real attendance records from Aeries API
 * Uses AttendanceHistory/details endpoint to get actual attendance data
 * No dependency on students table - pulls directly from Aeries per school
 */

const https = require('https');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const AERIES_API_KEY = process.env.AERIES_API_KEY;
const AERIES_BASE_URL = 'romolandapi.aeries.net';
const SCHOOL_YEAR = '2024-2025';

const stats = {
  schoolsProcessed: 0,
  studentsProcessed: 0,
  recordsCreated: 0,
  errors: 0,
  startTime: Date.now()
};

async function aeriesAPIRequest(endpoint) {
  return new Promise((resolve, reject) => {
    const fullPath = `/admin/api/v5${endpoint}`;
    const options = {
      hostname: AERIES_BASE_URL,
      path: fullPath,
      method: 'GET',
      headers: {
        'AERIES-CERT': AERIES_API_KEY,
        'Accept': 'application/json'
      }
    };

    console.log(`🔗 API Request: ${fullPath}`);

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

async function getSchoolAttendanceDetails(schoolCode) {
  try {
    console.log(`📚 Fetching attendance details for school ${schoolCode}...`);
    
    // Get attendance history details for the entire school for 2024-2025
    const result = await aeriesAPIRequest(`/schools/${schoolCode}/AttendanceHistory/details/year/${SCHOOL_YEAR}`);
    
    if (result.status === 200 && Array.isArray(result.data)) {
      console.log(`   ✅ Found ${result.data.length} students with attendance data`);
      return result.data;
    } else {
      console.log(`   ⚠️  No attendance data found for school ${schoolCode} (Status: ${result.status})`);
      return [];
    }
  } catch (error) {
    console.log(`   ❌ Error fetching attendance for school ${schoolCode}: ${error.message}`);
    stats.errors++;
    return [];
  }
}

function processAttendanceDetails(studentData, schoolCode, schoolId) {
  const records = [];
  
  if (!studentData.HistoryDetails || !Array.isArray(studentData.HistoryDetails)) {
    return records;
  }

  const aeriesStudentId = studentData.StudentID;
  console.log(`     🎓 Processing student ${aeriesStudentId} with ${studentData.HistoryDetails.length} attendance records`);

  studentData.HistoryDetails.forEach(detail => {
    // Only process records for the current school year
    if (detail.SchoolYear !== SCHOOL_YEAR) {
      return;
    }

    // Convert Aeries attendance codes to our schema
    const attendanceRecord = {
      aeries_student_id: aeriesStudentId.toString(),
      school_code: schoolCode,
      school_id: schoolId,
      attendance_date: detail.Date || null,
      is_present: detail.Code === 'P' || detail.Code === '' || detail.Code === null,
      is_full_day_absent: detail.Code === 'A' || detail.Code === 'U' || detail.Code === 'E',
      days_enrolled: detail.DaysEnrolled || 1.0,
      school_year: SCHOOL_YEAR,
      
      // Period-specific attendance (if available)
      period_1_status: determineAttendanceStatus(detail.Period1),
      period_2_status: determineAttendanceStatus(detail.Period2),
      period_3_status: determineAttendanceStatus(detail.Period3),
      period_4_status: determineAttendanceStatus(detail.Period4),
      period_5_status: determineAttendanceStatus(detail.Period5),
      period_6_status: determineAttendanceStatus(detail.Period6),
      period_7_status: determineAttendanceStatus(detail.Period7),
      
      // Additional fields
      tardy_count: detail.TardyCount || 0,
      can_be_corrected: true,
      correction_deadline: detail.Date ? 
        new Date(new Date(detail.Date).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : 
        null,
      
      // Metadata
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Only add records with valid dates
    if (attendanceRecord.attendance_date) {
      records.push(attendanceRecord);
    }
  });

  return records;
}

function determineAttendanceStatus(periodCode) {
  if (!periodCode || periodCode === 'P' || periodCode === '') {
    return 'PRESENT';
  }
  
  switch (periodCode.toUpperCase()) {
    case 'A': return 'ABSENT';
    case 'U': return 'UNEXCUSED_ABSENT';
    case 'E': return 'EXCUSED_ABSENT';
    case 'T': return 'TARDY';
    case 'S': return 'SUSPENDED';
    default: return 'ABSENT';
  }
}

async function getActiveSchools() {
  console.log('🏫 Fetching active schools from database...');
  
  const { data: schools, error } = await supabase
    .from('schools')
    .select('id, school_name, aeries_school_code')
    .eq('is_active', true)
    .order('aeries_school_code');

  if (error) {
    throw new Error(`Failed to fetch schools: ${error.message}`);
  }

  console.log(`✅ Found ${schools.length} active schools`);
  schools.forEach(school => {
    console.log(`   ${school.school_name} - Code: ${school.aeries_school_code}`);
  });

  return schools;
}

async function syncAttendanceFromAeries() {
  console.log('🚀 Starting Aeries Attendance Sync');
  console.log(`📅 Pulling real attendance data for school year ${SCHOOL_YEAR}`);
  console.log('============================================================');
  
  try {
    // Get all active schools
    const schools = await getActiveSchools();
    
    if (schools.length === 0) {
      console.log('❌ No active schools found');
      return;
    }

    // Process each school
    for (const school of schools) {
      console.log(`\n🏫 Processing ${school.school_name} (Code: ${school.aeries_school_code})`);
      stats.schoolsProcessed++;

      // Get attendance details from Aeries for this school
      const studentsData = await getSchoolAttendanceDetails(school.aeries_school_code);
      
      if (studentsData.length === 0) {
        console.log(`   ⚠️  No students with attendance data found for ${school.school_name}`);
        continue;
      }

      // Process all students for this school
      const allRecords = [];
      
      for (const studentData of studentsData) {
        stats.studentsProcessed++;
        
        const records = processAttendanceDetails(
          studentData, 
          school.aeries_school_code, 
          school.id
        );
        
        allRecords.push(...records);
      }

      // Insert records in batches
      if (allRecords.length > 0) {
        const batchSize = 1000;
        const batches = [];
        
        for (let i = 0; i < allRecords.length; i += batchSize) {
          batches.push(allRecords.slice(i, i + batchSize));
        }

        console.log(`   📦 Inserting ${allRecords.length} records in ${batches.length} batches...`);

        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
          const batch = batches[batchIndex];
          
          try {
            const { data, error: insertError } = await supabase
              .from('attendance_records')
              .insert(batch)
              .select();

            if (insertError) {
              console.log(`     ❌ Batch ${batchIndex + 1} insert error: ${insertError.message}`);
              stats.errors++;
            } else {
              const insertedCount = data ? data.length : batch.length;
              stats.recordsCreated += insertedCount;
              console.log(`     ✅ Batch ${batchIndex + 1}: Inserted ${insertedCount} records`);
            }
          } catch (e) {
            console.log(`     ❌ Batch ${batchIndex + 1} exception: ${e.message}`);
            stats.errors++;
          }

          // Rate limiting between batches
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // Rate limiting between schools
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Final results
    const totalTime = (Date.now() - stats.startTime) / 1000;
    console.log('\n' + '='.repeat(60));
    console.log('✅ AERIES ATTENDANCE SYNC COMPLETED!');
    console.log('='.repeat(60));
    console.log(`⏱️  Duration: ${totalTime.toFixed(1)} seconds (${(totalTime/60).toFixed(1)} minutes)`);
    console.log(`🏫 Schools processed: ${stats.schoolsProcessed}`);
    console.log(`👥 Students processed: ${stats.studentsProcessed}`);
    console.log(`📅 Records created: ${stats.recordsCreated}`);
    console.log(`❌ Errors: ${stats.errors}`);
    
    // Verify final data
    const { count } = await supabase
      .from('attendance_records')
      .select('*', { count: 'exact' });
    console.log(`📊 Total records in database: ${count}`);
    
    // Show date range
    const { data: dateRange } = await supabase
      .from('attendance_records')
      .select('attendance_date')
      .order('attendance_date');
    
    if (dateRange && dateRange.length > 0) {
      const uniqueDates = new Set(dateRange.map(r => r.attendance_date));
      const sortedDates = Array.from(uniqueDates).sort();
      console.log(`📅 Date range: ${sortedDates[0]} to ${sortedDates[sortedDates.length - 1]}`);
      console.log(`📅 Unique school days: ${uniqueDates.size}`);
    }

    // Show school distribution
    const { data: schoolStats } = await supabase
      .from('attendance_records')
      .select('school_code, school_id')
      .order('school_code');
    
    if (schoolStats && schoolStats.length > 0) {
      const schoolCounts = {};
      schoolStats.forEach(record => {
        schoolCounts[record.school_code] = (schoolCounts[record.school_code] || 0) + 1;
      });
      
      console.log(`📊 Records by school code:`);
      Object.entries(schoolCounts).forEach(([code, count]) => {
        console.log(`   School ${code}: ${count} records`);
      });
    }
    
  } catch (error) {
    console.error('❌ Sync failed:', error);
    process.exit(1);
  }
}

// Run the sync
if (require.main === module) {
  syncAttendanceFromAeries().then(() => {
    console.log('\n✅ Aeries attendance sync complete!');
    process.exit(0);
  }).catch(error => {
    console.error('\n❌ Aeries attendance sync failed:', error);
    process.exit(1);
  });
}

module.exports = { syncAttendanceFromAeries };