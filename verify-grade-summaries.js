#!/usr/bin/env node

/**
 * Verification script for grade_attendance_summaries table
 * This script will:
 * 1. Examine the current grade_attendance_summaries data
 * 2. Recalculate the data from attendance_records
 * 3. Compare and identify discrepancies
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyGradeSummaries() {
  console.log('🔍 Verifying grade_attendance_summaries Data\n');
  
  try {
    // 1. Get current grade_attendance_summaries data
    console.log('📊 Current grade_attendance_summaries data:');
    await examineCurrentData();
    
    // 2. Get attendance_records summary for comparison
    console.log('\n🔄 Recalculating from attendance_records:');
    await recalculateFromAttendanceRecords();
    
    // 3. Compare and show discrepancies
    console.log('\n⚖️ Comparison and Analysis:');
    await compareData();

  } catch (error) {
    console.error('❌ Error verifying grade summaries:', error);
  }
}

async function examineCurrentData() {
  try {
    const { data, error, count } = await supabase
      .from('grade_attendance_summaries')
      .select('*')
      .order('school_name, grade_level');

    if (error) {
      console.log(`  ❌ Error: ${error.message}`);
      return;
    }

    console.log(`  ✅ Found ${count} records in grade_attendance_summaries\n`);
    
    if (data && data.length > 0) {
      // Show table structure
      console.log('  📋 Table Structure:');
      const sampleRecord = data[0];
      Object.keys(sampleRecord).forEach(key => {
        const value = sampleRecord[key];
        const type = typeof value;
        console.log(`     ${key}: ${type} ${value !== null ? `(e.g., ${value})` : '(null)'}`);
      });
      
      console.log('\n  📊 Current Data Summary:');
      console.log('     School                  | Grade | Students | Attendance Rate');
      console.log('     ----------------------- | ----- | -------- | ---------------');
      
      data.forEach(record => {
        const schoolName = (record.school_name || 'Unknown').padEnd(23);
        const grade = String(record.grade_level || 'N/A').padEnd(5);
        const students = String(record.total_students || 0).padEnd(8);
        const rate = record.attendance_rate ? `${record.attendance_rate}%` : 'N/A';
        console.log(`     ${schoolName} | ${grade} | ${students} | ${rate}`);
      });
      
      // Calculate totals
      const totalStudents = data.reduce((sum, record) => sum + (record.total_students || 0), 0);
      const avgAttendanceRate = data.reduce((sum, record, index, array) => {
        return sum + (record.attendance_rate || 0) / array.length;
      }, 0);
      
      console.log('     ----------------------- | ----- | -------- | ---------------');
      console.log(`     TOTALS                  |       | ${totalStudents}     | ${avgAttendanceRate.toFixed(1)}% (avg)`);
    }
    
  } catch (err) {
    console.log(`  ❌ Error examining current data: ${err.message}`);
  }
}

async function recalculateFromAttendanceRecords() {
  try {
    console.log('  🔄 Querying attendance_records to recalculate grade summaries...\n');
    
    // First, let's examine the attendance_records table structure
    console.log('  🔍 Examining attendance_records table structure...');
    const { data: sampleRecord, error: sampleError } = await supabase
      .from('attendance_records')
      .select('*')
      .limit(1);
      
    if (sampleError) {
      console.log(`  ❌ Error getting sample record: ${sampleError.message}`);
      return;
    }
    
    if (sampleRecord && sampleRecord.length > 0) {
      console.log('  📋 Available columns in attendance_records:');
      console.log('     ', Object.keys(sampleRecord[0]).join(', '));
    }
    
    // Get students data as the base table (using sample for performance)
    console.log('  👥 Getting students as base table (sample)...');
    
    const { data: studentsData, error: studentsError } = await supabase
      .from('students')
      .select('aeries_student_id, grade_level, school_id, id')
      .limit(100);

    if (studentsError) {
      console.log(`  ❌ Error querying students: ${studentsError.message}`);
      return;
    }

    // Get attendance data for these specific students
    console.log('  🔗 Getting attendance_records for these students via aeries_student_id...');
    
    const aeriesIds = studentsData.map(s => s.aeries_student_id);
    const { data: attendanceData, error } = await supabase
      .from('attendance_records')
      .select('aeries_student_id, school_id, attendance_date, is_present')
      .in('aeries_student_id', aeriesIds);

    if (error) {
      console.log(`  ❌ Error querying attendance_records: ${error.message}`);
      return;
    }

    // Get schools data for names
    const { data: schoolsData, error: schoolsError } = await supabase
      .from('schools')
      .select('id, school_name');

    if (schoolsError) {
      console.log(`  ❌ Error querying schools: ${schoolsError.message}`);
      return;
    }

    // Create lookups using aeries_student_id as key
    const studentLookup = {};
    studentsData.forEach(student => {
      studentLookup[student.aeries_student_id] = {
        grade_level: student.grade_level,
        school_id: student.school_id,
        id: student.id
      };
    });

    const schoolLookup = {};
    schoolsData.forEach(school => {
      schoolLookup[school.id] = school.school_name;
    });

    console.log(`  ✅ Found ${studentsData.length} students (base table)`);
    console.log(`  ✅ Found ${attendanceData.length} attendance records`);
    console.log(`  ✅ Found ${schoolsData.length} school records\n`);
    
    // Process the joined data to calculate summaries (students as base)
    const gradeSummaries = calculateGradeSummariesFromStudents(studentsData, attendanceData, schoolLookup);
    
    console.log('  📊 Recalculated Data Summary:');
    console.log('     School                  | Grade | Students | Attendance Rate | Records');
    console.log('     ----------------------- | ----- | -------- | --------------- | -------');
    
    Object.entries(gradeSummaries)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([key, summary]) => {
        const schoolName = summary.school_name.padEnd(23);
        const grade = String(summary.grade_level).padEnd(5);
        const students = String(summary.total_students).padEnd(8);
        const rate = `${summary.attendance_rate.toFixed(1)}%`;
        const records = String(summary.total_records).padEnd(7);
        console.log(`     ${schoolName} | ${grade} | ${students} | ${rate}        | ${records}`);
      });
    
    // Store for comparison
    global.recalculatedData = gradeSummaries;
    
  } catch (err) {
    console.log(`  ❌ Error recalculating: ${err.message}`);
  }
}

function calculateGradeSummariesFromStudents(studentsData, attendanceData, schoolLookup) {
  const summaries = {};
  let matchedRecords = 0;
  let unmatchedRecords = 0;
  
  // Create attendance lookup by aeries_student_id
  const attendanceLookup = {};
  attendanceData.forEach(record => {
    const key = record.aeries_student_id;
    if (!attendanceLookup[key]) {
      attendanceLookup[key] = [];
    }
    attendanceLookup[key].push(record);
  });
  
  // Process each student (base table)
  studentsData.forEach(student => {
    const key = `${student.school_id}_${student.grade_level}`;
    
    // Initialize summary for this school/grade combination
    if (!summaries[key]) {
      summaries[key] = {
        school_id: student.school_id,
        school_name: schoolLookup[student.school_id] || 'Unknown School',
        grade_level: student.grade_level,
        students: new Set(),
        total_records: 0,
        present_records: 0
      };
    }
    
    // Add student to count
    summaries[key].students.add(student.aeries_student_id);
    
    // Find attendance records for this student
    const studentAttendance = attendanceLookup[student.aeries_student_id] || [];
    
    if (studentAttendance.length > 0) {
      matchedRecords += studentAttendance.length;
      
      // Process attendance records
      studentAttendance.forEach(record => {
        summaries[key].total_records++;
        if (record.is_present) {
          summaries[key].present_records++;
        }
      });
    } else {
      // Student has no attendance records
      unmatchedRecords++;
    }
  });
  
  console.log(`  📊 Join Statistics: ${matchedRecords} attendance records matched to students, ${unmatchedRecords} students with no attendance\n`);
  
  // Calculate final statistics
  Object.keys(summaries).forEach(key => {
    const summary = summaries[key];
    summary.total_students = summary.students.size;
    summary.attendance_rate = summary.total_records > 0 
      ? (summary.present_records / summary.total_records) * 100 
      : 0;
    
    // Clean up the Set for comparison
    delete summary.students;
  });
  
  return summaries;
}

async function compareData() {
  try {
    // Get current data again for comparison
    const { data: currentData, error } = await supabase
      .from('grade_attendance_summaries')
      .select('*')
      .order('school_id, grade_level');

    if (error || !global.recalculatedData) {
      console.log('  ❌ Cannot compare - missing data');
      return;
    }

    console.log('  ⚖️ Comparing current vs recalculated data:\n');
    
    // Create lookup for current data
    const currentLookup = {};
    currentData.forEach(record => {
      const key = `${record.school_id}_${record.grade_level}`;
      currentLookup[key] = record;
    });
    
    const recalculated = global.recalculatedData;
    let discrepancies = 0;
    
    console.log('  📊 Discrepancy Analysis:');
    console.log('     Key                     | Current Rate | Recalc Rate | Difference | Status');
    console.log('     ----------------------- | ------------ | ----------- | ---------- | ------');
    
    // Check each recalculated entry
    Object.entries(recalculated).forEach(([key, recalc]) => {
      const current = currentLookup[key];
      const keyDisplay = `${recalc.school_name}_Grade${recalc.grade_level}`.substring(0, 23).padEnd(23);
      
      if (!current) {
        console.log(`     ${keyDisplay} | MISSING      | ${recalc.attendance_rate.toFixed(1)}%     | N/A        | ❌ MISSING`);
        discrepancies++;
      } else {
        const currentRate = current.attendance_rate || 0;
        const recalcRate = recalc.attendance_rate;
        const diff = Math.abs(currentRate - recalcRate);
        const status = diff > 0.1 ? '❌ DIFF' : '✅ OK';
        
        if (diff > 0.1) discrepancies++;
        
        console.log(`     ${keyDisplay} | ${currentRate}%        | ${recalcRate.toFixed(1)}%     | ${diff.toFixed(1)}%      | ${status}`);
      }
    });
    
    // Check for records in current that aren't in recalculated
    currentData.forEach(current => {
      const key = `${current.school_id}_${current.grade_level}`;
      if (!recalculated[key]) {
        const keyDisplay = `${current.school_name}_Grade${current.grade_level}`.substring(0, 23).padEnd(23);
        console.log(`     ${keyDisplay} | ${current.attendance_rate}%        | MISSING     | N/A        | ❌ EXTRA`);
        discrepancies++;
      }
    });
    
    console.log('     ----------------------- | ------------ | ----------- | ---------- | ------');
    console.log(`     SUMMARY: ${discrepancies > 0 ? '❌' : '✅'} ${discrepancies} discrepancies found`);
    
    if (discrepancies > 0) {
      console.log('\n  🔧 Recommended Actions:');
      console.log('     1. Review the grade_attendance_summaries calculation logic');
      console.log('     2. Consider regenerating the summary data from attendance_records');
      console.log('     3. Check for data filtering or date range differences');
    } else {
      console.log('\n  ✅ Data appears to be correct!');
    }
    
  } catch (err) {
    console.log(`  ❌ Error comparing data: ${err.message}`);
  }
}

// Run the verification
if (require.main === module) {
  verifyGradeSummaries().then(() => {
    console.log('\n✅ Verification complete!');
    process.exit(0);
  }).catch(error => {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
  });
}

module.exports = { verifyGradeSummaries };