#!/usr/bin/env node

/**
 * Investigate Aeries API school mapping and student data import
 * Check for mismatches between school codes and student assignments
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function investigateAeriesMapping() {
  console.log('🔍 Investigating Aeries API school mapping and student data import\n');
  
  try {
    // 1. Examine all students with their school assignments
    console.log('👥 Step 1: Analyzing student school assignments...');
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('aeries_student_id, school_id, grade_level, created_at')
      .order('created_at', { ascending: false })
      .limit(1000);

    if (studentsError) {
      throw new Error(`Failed to get students: ${studentsError.message}`);
    }

    console.log(`✅ Retrieved ${students.length} students`);

    // Group students by school_id
    const studentsBySchool = {};
    students.forEach(student => {
      if (!studentsBySchool[student.school_id]) {
        studentsBySchool[student.school_id] = [];
      }
      studentsBySchool[student.school_id].push(student);
    });

    console.log(`✅ Students distributed across ${Object.keys(studentsBySchool).length} school IDs:`);
    for (const [schoolId, schoolStudents] of Object.entries(studentsBySchool)) {
      console.log(`   ${schoolId.substring(0, 8)}...: ${schoolStudents.length} students`);
    }

    // 2. Get school information and match with students
    console.log('\n🏫 Step 2: Matching schools table with student assignments...');
    const { data: schools, error: schoolsError } = await supabase
      .from('schools')
      .select('id, school_name, school_code')
      .order('school_name');

    if (schoolsError) {
      throw new Error(`Failed to get schools: ${schoolsError.message}`);
    }

    console.log('✅ School mapping analysis:');
    schools.forEach(school => {
      const studentCount = studentsBySchool[school.id]?.length || 0;
      console.log(`   ${school.school_name} (${school.school_code})`);
      console.log(`     ID: ${school.id}`);
      console.log(`     Students: ${studentCount}`);
      
      if (studentCount > 0) {
        const grades = [...new Set(studentsBySchool[school.id].map(s => s.grade_level))];
        console.log(`     Grades: ${grades.sort().join(', ')}`);
      }
    });

    // 3. Check attendance records for school code patterns
    console.log('\n📊 Step 3: Analyzing attendance records school assignments...');
    const { data: attendanceSample, error: attendanceError } = await supabase
      .from('attendance_records')
      .select('aeries_student_id, school_id, school_code, attendance_date')
      .limit(100);

    if (attendanceError) {
      throw new Error(`Failed to get attendance sample: ${attendanceError.message}`);
    }

    // Group attendance by school_code and school_id
    const attendanceBySchoolCode = {};
    const attendanceBySchoolId = {};
    
    attendanceSample.forEach(record => {
      // By school_code
      if (!attendanceBySchoolCode[record.school_code]) {
        attendanceBySchoolCode[record.school_code] = [];
      }
      attendanceBySchoolCode[record.school_code].push(record);
      
      // By school_id
      if (!attendanceBySchoolId[record.school_id]) {
        attendanceBySchoolId[record.school_id] = [];
      }
      attendanceBySchoolId[record.school_id].push(record);
    });

    console.log('✅ Attendance records by school_code:');
    for (const [schoolCode, records] of Object.entries(attendanceBySchoolCode)) {
      console.log(`   ${schoolCode}: ${records.length} records`);
    }

    console.log('\n✅ Attendance records by school_id:');
    for (const [schoolId, records] of Object.entries(attendanceBySchoolId)) {
      console.log(`   ${schoolId.substring(0, 8)}...: ${records.length} records`);
    }

    // 4. Cross-reference student school assignments with attendance records
    console.log('\n🔗 Step 4: Cross-referencing student assignments with attendance...');
    
    // Get sample students and check their attendance records
    const sampleStudentIds = students.slice(0, 20).map(s => s.aeries_student_id);
    const { data: studentAttendance, error: studentAttendanceError } = await supabase
      .from('attendance_records')
      .select('aeries_student_id, school_id, school_code')
      .in('aeries_student_id', sampleStudentIds);

    if (studentAttendanceError) {
      throw new Error(`Failed to get student attendance: ${studentAttendanceError.message}`);
    }

    console.log('✅ Checking school_id consistency between students and attendance_records:');
    
    let mismatches = 0;
    let matches = 0;
    
    for (const student of students.slice(0, 20)) {
      const studentAttendanceRecords = studentAttendance.filter(a => a.aeries_student_id === student.aeries_student_id);
      
      if (studentAttendanceRecords.length > 0) {
        const attendanceSchoolIds = [...new Set(studentAttendanceRecords.map(a => a.school_id))];
        const attendanceSchoolCodes = [...new Set(studentAttendanceRecords.map(a => a.school_code))];
        
        if (attendanceSchoolIds.includes(student.school_id)) {
          matches++;
          console.log(`   ✅ Student ${student.aeries_student_id}: MATCH (${student.school_id.substring(0, 8)}...)`);
        } else {
          mismatches++;
          console.log(`   ❌ Student ${student.aeries_student_id}: MISMATCH`);
          console.log(`       Student table school_id: ${student.school_id.substring(0, 8)}...`);
          console.log(`       Attendance school_id(s): ${attendanceSchoolIds.map(id => id.substring(0, 8) + '...').join(', ')}`);
          console.log(`       Attendance school_code(s): ${attendanceSchoolCodes.join(', ')}`);
        }
      } else {
        console.log(`   ⚠️  Student ${student.aeries_student_id}: No attendance records found`);
      }
    }

    console.log(`\n📊 Summary: ${matches} matches, ${mismatches} mismatches out of 20 sampled students`);

    // 5. Check if there are school codes that don't match our schools table
    console.log('\n🔍 Step 5: Identifying unknown school codes in attendance data...');
    
    const { data: allAttendanceCodes, error: allAttendanceError } = await supabase
      .from('attendance_records')
      .select('school_code')
      .not('school_code', 'is', null);

    if (allAttendanceError) {
      throw new Error(`Failed to get all attendance school codes: ${allAttendanceError.message}`);
    }

    const uniqueAttendanceCodes = [...new Set(allAttendanceCodes.map(r => r.school_code))];
    const knownSchoolCodes = schools.map(s => s.school_code);
    
    console.log(`✅ School codes in attendance_records: ${uniqueAttendanceCodes.join(', ')}`);
    console.log(`✅ School codes in schools table: ${knownSchoolCodes.join(', ')}`);

    const unknownCodes = uniqueAttendanceCodes.filter(code => !knownSchoolCodes.includes(code));
    const missingCodes = knownSchoolCodes.filter(code => !uniqueAttendanceCodes.includes(code));

    if (unknownCodes.length > 0) {
      console.log(`⚠️  Unknown school codes in attendance data: ${unknownCodes.join(', ')}`);
    }
    if (missingCodes.length > 0) {
      console.log(`⚠️  School codes missing from attendance data: ${missingCodes.join(', ')}`);
    }

    // 6. Check if students are being assigned to wrong schools during import
    console.log('\n🔍 Step 6: Investigating potential school assignment issues...');
    
    // Check if all students are going to just 2 schools when there should be 7
    console.log('Current student distribution:');
    for (const [schoolId, schoolStudents] of Object.entries(studentsBySchool)) {
      const school = schools.find(s => s.id === schoolId);
      const schoolName = school ? school.school_name : 'Unknown School';
      const schoolCode = school ? school.school_code : 'Unknown Code';
      
      console.log(`   ${schoolName} (${schoolCode}): ${schoolStudents.length} students`);
      
      // Sample grades for this school
      if (schoolStudents.length > 0) {
        const gradeCounts = {};
        schoolStudents.forEach(student => {
          const grade = student.grade_level;
          gradeCounts[grade] = (gradeCounts[grade] || 0) + 1;
        });
        console.log(`     Grade distribution: ${Object.entries(gradeCounts).map(([grade, count]) => `${grade}: ${count}`).join(', ')}`);
      }
    }

    // 7. Check sync operation logs for clues
    console.log('\n📋 Step 7: Checking sync operation logs...');
    const { data: syncOps, error: syncError } = await supabase
      .from('aeries_sync_operations')
      .select('operation_type, status, records_processed, error_details, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (!syncError && syncOps && syncOps.length > 0) {
      console.log('✅ Recent sync operations:');
      syncOps.forEach(op => {
        console.log(`   ${op.created_at}: ${op.operation_type} - ${op.status}`);
        console.log(`     Records: ${op.records_processed || 'N/A'}, Errors: ${op.error_details || 'None'}`);
      });
    } else {
      console.log('⚠️  No sync operation logs found or accessible');
    }

    // 8. Recommendations
    console.log('\n💡 Analysis Results and Recommendations:');
    console.log('==========================================');

    if (mismatches > matches) {
      console.log('🚨 CRITICAL ISSUE: School ID mismatches detected between students and attendance records');
      console.log('   This suggests the student import process is assigning wrong school IDs');
    }

    if (unknownCodes.length > 0) {
      console.log('🚨 ISSUE: Unknown school codes in attendance data');
      console.log('   The Aeries API may be returning school codes not in your schools table');
      console.log(`   Unknown codes: ${unknownCodes.join(', ')}`);
    }

    if (Object.keys(studentsBySchool).length === 2 && schools.length === 7) {
      console.log('🚨 MAJOR ISSUE: Students are only assigned to 2 schools out of 7 available schools');
      console.log('   This indicates a systematic problem in the student import process');
      console.log('   Possible causes:');
      console.log('   1. Student import is only processing certain schools');
      console.log('   2. School ID mapping is incorrect during student import');
      console.log('   3. Students from multiple schools are being assigned to default schools');
    }

    if (missingCodes.length > 0) {
      console.log('⚠️  WARNING: Some schools have no attendance data');
      console.log(`   Missing school codes in attendance: ${missingCodes.join(', ')}`);
      console.log('   These schools may not be included in the Aeries attendance sync');
    }

    console.log('\n🔧 Recommended Actions:');
    console.log('1. Check the student import logic to ensure proper school_id assignment');
    console.log('2. Verify the Aeries API school code mapping configuration');
    console.log('3. Re-sync student data with corrected school assignments');
    console.log('4. Update attendance sync to include all school codes');

  } catch (error) {
    console.error('\n❌ Error investigating Aeries mapping:', error);
  }
}

// Run the investigation
if (require.main === module) {
  investigateAeriesMapping().then(() => {
    console.log('\n✅ Aeries mapping investigation complete!');
    process.exit(0);
  }).catch(error => {
    console.error('\n❌ Aeries mapping investigation failed:', error);
    process.exit(1);
  });
}

module.exports = { investigateAeriesMapping };