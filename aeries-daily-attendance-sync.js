#!/usr/bin/env node

/**
 * Aeries Daily Attendance Sync - Pull individual daily attendance records
 * Uses /schools/{SchoolCode}/attendance/{StudentID} endpoint for actual daily data
 * Matches Aeries API structure exactly
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

// School year 2024-2025 date range (Aug 15, 2024 to Jun 12, 2025)
const START_DATE = '20240815'; // Aug 15, 2024
const END_DATE = '20250612';   // Jun 12, 2025

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

async function getStudentAttendance(studentId, schoolCode) {
  try {
    // Get student's attendance for the school year with date filters
    const endpoint = `/schools/${schoolCode}/attendance/${studentId}?StartDate=${START_DATE}&EndDate=${END_DATE}`;
    console.log(`     📅 Fetching attendance for student ${studentId}...`);
    
    const result = await aeriesAPIRequest(endpoint);
    
    if (result.status === 200 && Array.isArray(result.data)) {
      console.log(`       ✅ Found ${result.data.length} attendance days`);
      return result.data;
    } else if (result.status === 404) {
      console.log(`       ℹ️  No attendance data found for student ${studentId}`);
      return [];
    } else {
      console.log(`       ⚠️  Unexpected response for student ${studentId}: ${result.status}`);
      return [];
    }
  } catch (error) {
    console.log(`       ❌ Error fetching attendance for student ${studentId}: ${error.message}`);
    stats.errors++;
    return [];
  }
}

function processAttendanceDay(attendanceDay, studentId, schoolCode, schoolId) {
  if (!attendanceDay.CalendarDate) {
    return null;
  }

  // Convert YYYYMMDD to YYYY-MM-DD format
  const dateStr = attendanceDay.CalendarDate.toString();
  const formattedDate = `${dateStr.substring(0,4)}-${dateStr.substring(4,6)}-${dateStr.substring(6,8)}`;

  const record = {
    aeries_student_id: studentId.toString(),
    school_code: schoolCode.toString(),
    school_id: schoolId,
    calendar_date: formattedDate,
    all_day_attendance_code: attendanceDay.AllDayAttendanceCode || null,
    school_year: '2024-2025',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  // Process period-specific attendance from Classes array
  if (attendanceDay.Classes && Array.isArray(attendanceDay.Classes)) {
    attendanceDay.Classes.forEach(classRecord => {
      const period = classRecord.Period;
      if (period && period >= 1 && period <= 9) {
        record[`period_${period}_code`] = classRecord.AttendanceCode || null;
        record[`period_${period}_section`] = classRecord.SectionNumber || null;
      }
    });
  }

  return record;
}

async function getStudentsForSchool(schoolCode) {
  try {
    console.log(`   🔍 Getting students from Aeries for school ${schoolCode}...`);
    
    // First try to get students list from Aeries
    // Note: This might require a different endpoint - check Aeries docs
    const result = await aeriesAPIRequest(`/schools/${schoolCode}/students`);
    
    if (result.status === 200 && Array.isArray(result.data)) {
      console.log(`     ✅ Found ${result.data.length} students in Aeries`);
      return result.data.map(student => student.StudentID || student.ID);
    } else {
      console.log(`     ⚠️  No students endpoint available, will need to use existing student list`);
      
      // Fallback: Get students from our database that are assigned to this school
      const { data: dbStudents } = await supabase
        .from('students')
        .select('aeries_student_id')
        .eq('school_id', (await getSchoolIdByCode(schoolCode)));
      
      if (dbStudents && dbStudents.length > 0) {
        console.log(`     📊 Using ${dbStudents.length} students from database`);
        return dbStudents.map(s => s.aeries_student_id);
      }
      
      return [];
    }
  } catch (error) {
    console.log(`     ❌ Error getting students: ${error.message}`);
    return [];
  }
}

async function getSchoolIdByCode(schoolCode) {
  const { data: school } = await supabase
    .from('schools')
    .select('id')
    .eq('aeries_school_code', schoolCode)
    .single();
  
  return school ? school.id : null;
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

async function syncDailyAttendanceFromAeries() {
  console.log('🚀 Starting Aeries Daily Attendance Sync');
  console.log(`📅 Pulling individual attendance records for ${START_DATE} to ${END_DATE}`);
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

      // Get list of students for this school
      const studentIds = await getStudentsForSchool(school.aeries_school_code);
      
      if (studentIds.length === 0) {
        console.log(`   ⚠️  No students found for ${school.school_name}`);
        continue;
      }

      console.log(`   👥 Processing ${studentIds.length} students...`);

      // Process students in smaller batches to avoid overwhelming the API
      const batchSize = 5;
      const studentBatches = [];
      
      for (let i = 0; i < studentIds.length; i += batchSize) {
        studentBatches.push(studentIds.slice(i, i + batchSize));
      }

      for (let batchIndex = 0; batchIndex < studentBatches.length; batchIndex++) {
        const batch = studentBatches[batchIndex];
        console.log(`     📦 Processing student batch ${batchIndex + 1}/${studentBatches.length} (${batch.length} students)`);

        const allRecords = [];

        // Process each student in the batch
        for (const studentId of batch) {
          stats.studentsProcessed++;
          
          const attendanceDays = await getStudentAttendance(studentId, school.aeries_school_code);
          
          // Convert each attendance day to our format
          attendanceDays.forEach(attendanceDay => {
            const record = processAttendanceDay(
              attendanceDay,
              studentId,
              school.aeries_school_code,
              school.id
            );
            
            if (record) {
              allRecords.push(record);
            }
          });

          // Rate limiting between students
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Insert batch if we have records
        if (allRecords.length > 0) {
          try {
            const { data, error: insertError } = await supabase
              .from('attendance_records')
              .insert(allRecords)
              .select();

            if (insertError) {
              console.log(`       ❌ Batch insert error: ${insertError.message}`);
              stats.errors++;
            } else {
              const insertedCount = data ? data.length : allRecords.length;
              stats.recordsCreated += insertedCount;
              console.log(`       ✅ Inserted ${insertedCount} attendance records`);
            }
          } catch (e) {
            console.log(`       ❌ Insert exception: ${e.message}`);
            stats.errors++;
          }
        }

        // Rate limiting between batches
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Rate limiting between schools
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Final results
    const totalTime = (Date.now() - stats.startTime) / 1000;
    console.log('\n' + '='.repeat(60));
    console.log('✅ AERIES DAILY ATTENDANCE SYNC COMPLETED!');
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
      .select('calendar_date')
      .order('calendar_date');
    
    if (dateRange && dateRange.length > 0) {
      const uniqueDates = new Set(dateRange.map(r => r.calendar_date));
      const sortedDates = Array.from(uniqueDates).sort();
      console.log(`📅 Date range: ${sortedDates[0]} to ${sortedDates[sortedDates.length - 1]}`);
      console.log(`📅 Unique school days: ${uniqueDates.size}`);
    }

    // Show school distribution
    const { data: schoolStats } = await supabase
      .from('attendance_records')
      .select('school_code')
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
  syncDailyAttendanceFromAeries().then(() => {
    console.log('\n✅ Aeries daily attendance sync complete!');
    process.exit(0);
  }).catch(error => {
    console.error('\n❌ Aeries daily attendance sync failed:', error);
    process.exit(1);
  });
}

module.exports = { syncDailyAttendanceFromAeries };