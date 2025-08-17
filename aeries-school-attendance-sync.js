#!/usr/bin/env node

/**
 * Aeries School Attendance Sync - Pull all attendance records by school
 * Uses /schools/{SchoolCode}/attendance endpoint (without student ID) for all school data
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
    req.setTimeout(60000, () => reject(new Error('Request timeout')));
    req.end();
  });
}

async function getSchoolAttendance(schoolCode) {
  try {
    // Get all attendance for the school (all students) with date filters
    const endpoint = `/schools/${schoolCode}/attendance?StartDate=${START_DATE}&EndDate=${END_DATE}`;
    console.log(`     📅 Fetching all attendance for school ${schoolCode}...`);
    console.log(`     🔗 Endpoint: ${endpoint}`);
    
    const result = await aeriesAPIRequest(endpoint);
    
    if (result.status === 200 && Array.isArray(result.data)) {
      console.log(`       ✅ Found ${result.data.length} attendance records`);
      return result.data;
    } else if (result.status === 404) {
      console.log(`       ℹ️  No attendance data found for school ${schoolCode}`);
      return [];
    } else {
      console.log(`       ⚠️  Unexpected response for school ${schoolCode}: ${result.status}`);
      console.log(`       📄 Response: ${JSON.stringify(result.data).substring(0, 200)}...`);
      return [];
    }
  } catch (error) {
    console.log(`       ❌ Error fetching attendance for school ${schoolCode}: ${error.message}`);
    stats.errors++;
    return [];
  }
}

function processAttendanceRecord(attendanceRecord, schoolCode, schoolId) {
  // The API might return different structures, let's handle both possibilities
  
  // If it's an individual attendance day record
  if (attendanceRecord.CalendarDate) {
    return processAttendanceDay(attendanceRecord, attendanceRecord.StudentID, schoolCode, schoolId);
  }
  
  // If it's a student object with AttendanceDays array
  if (attendanceRecord.StudentID && attendanceRecord.AttendanceDays) {
    const records = [];
    attendanceRecord.AttendanceDays.forEach(attendanceDay => {
      const record = processAttendanceDay(attendanceDay, attendanceRecord.StudentID, schoolCode, schoolId);
      if (record) {
        records.push(record);
      }
    });
    return records;
  }
  
  return null;
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

async function syncSchoolAttendanceFromAeries() {
  console.log('🚀 Starting Aeries School Attendance Sync');
  console.log(`📅 Pulling attendance records for entire schools (${START_DATE} to ${END_DATE})`);
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

      // Get all attendance for this school
      const attendanceData = await getSchoolAttendance(school.aeries_school_code);
      
      if (attendanceData.length === 0) {
        console.log(`   ⚠️  No attendance data found for ${school.school_name}`);
        continue;
      }

      console.log(`   📊 Processing ${attendanceData.length} attendance records...`);

      // Process all attendance records
      const allRecords = [];
      
      attendanceData.forEach(attendanceRecord => {
        const processed = processAttendanceRecord(attendanceRecord, school.aeries_school_code, school.id);
        
        if (Array.isArray(processed)) {
          // Multiple records from one student
          allRecords.push(...processed);
          stats.studentsProcessed++;
        } else if (processed) {
          // Single record
          allRecords.push(processed);
          stats.studentsProcessed++;
        }
      });

      console.log(`   📦 Prepared ${allRecords.length} records for insertion`);

      // Insert records in batches
      if (allRecords.length > 0) {
        const batchSize = 1000;
        const batches = [];
        
        for (let i = 0; i < allRecords.length; i += batchSize) {
          batches.push(allRecords.slice(i, i + batchSize));
        }

        console.log(`   🚀 Inserting records in ${batches.length} batches...`);

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
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // Final results
    const totalTime = (Date.now() - stats.startTime) / 1000;
    console.log('\n' + '='.repeat(60));
    console.log('✅ AERIES SCHOOL ATTENDANCE SYNC COMPLETED!');
    console.log('='.repeat(60));
    console.log(`⏱️  Duration: ${totalTime.toFixed(1)} seconds (${(totalTime/60).toFixed(1)} minutes)`);
    console.log(`🏫 Schools processed: ${stats.schoolsProcessed}`);
    console.log(`👥 Student records processed: ${stats.studentsProcessed}`);
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
  syncSchoolAttendanceFromAeries().then(() => {
    console.log('\n✅ Aeries school attendance sync complete!');
    process.exit(0);
  }).catch(error => {
    console.error('\n❌ Aeries school attendance sync failed:', error);
    process.exit(1);
  });
}

module.exports = { syncSchoolAttendanceFromAeries };