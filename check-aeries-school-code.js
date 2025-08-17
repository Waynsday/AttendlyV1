#!/usr/bin/env node

/**
 * Check aeries_school_code column in schools table and verify student import logic
 * Investigate if student assignments should use aeries_school_code for mapping
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkAeriesSchoolCode() {
  console.log('🔍 Checking aeries_school_code mapping and student import logic\n');
  
  try {
    // 1. Examine schools table with aeries_school_code
    console.log('🏫 Step 1: Examining schools table with aeries_school_code...');
    const { data: schools, error: schoolsError } = await supabase
      .from('schools')
      .select('id, school_name, school_code, aeries_school_code')
      .order('school_name');

    if (schoolsError) {
      throw new Error(`Failed to get schools: ${schoolsError.message}`);
    }

    console.log(`✅ Found ${schools.length} schools with aeries_school_code mapping:`);
    schools.forEach((school, i) => {
      console.log(`  ${i + 1}. ${school.school_name}`);
      console.log(`     School Code: ${school.school_code}`);
      console.log(`     Aeries School Code: ${school.aeries_school_code}`);
      console.log(`     UUID: ${school.id.substring(0, 8)}...`);
      console.log('');
    });

    // 2. Check what aeries_school_code values exist in attendance_records
    console.log('📊 Step 2: Checking school codes in attendance_records...');
    const { data: attendanceSchoolCodes, error: attendanceError } = await supabase
      .from('attendance_records')
      .select('school_code')
      .not('school_code', 'is', null);

    if (attendanceError) {
      throw new Error(`Failed to get attendance school codes: ${attendanceError.message}`);
    }

    const uniqueAttendanceCodes = [...new Set(attendanceSchoolCodes.map(r => r.school_code))];
    console.log(`✅ Unique school codes in attendance_records: ${uniqueAttendanceCodes.join(', ')}`);

    // 3. Check if attendance school codes match aeries_school_code in schools table
    console.log('\n🔗 Step 3: Matching attendance school codes with aeries_school_code...');
    
    const aeriesSchoolCodes = schools.map(s => s.aeries_school_code);
    console.log(`✅ Aeries school codes in schools table: ${aeriesSchoolCodes.join(', ')}`);

    const matchingCodes = uniqueAttendanceCodes.filter(code => aeriesSchoolCodes.includes(code));
    const missingCodes = uniqueAttendanceCodes.filter(code => !aeriesSchoolCodes.includes(code));
    const unusedCodes = aeriesSchoolCodes.filter(code => !uniqueAttendanceCodes.includes(code));

    console.log(`✅ Matching codes: ${matchingCodes.join(', ') || 'NONE'}`);
    if (missingCodes.length > 0) {
      console.log(`⚠️  Attendance codes not in schools table: ${missingCodes.join(', ')}`);
    }
    if (unusedCodes.length > 0) {
      console.log(`⚠️  Aeries codes with no attendance data: ${unusedCodes.join(', ')}`);
    }

    // 4. Check if students table has aeries_school_code or similar field
    console.log('\n👥 Step 4: Examining students table structure for school mapping...');
    const { data: studentSample, error: studentError } = await supabase
      .from('students')
      .select('*')
      .limit(1);

    if (studentError) {
      throw new Error(`Failed to get student sample: ${studentError.message}`);
    }

    if (studentSample && studentSample.length > 0) {
      console.log('✅ Students table columns:');
      Object.keys(studentSample[0]).forEach(key => {
        const value = studentSample[0][key];
        console.log(`   ${key}: ${typeof value} ${value !== null ? `(e.g., ${value})` : '(null)'}`);
      });
    }

    // 5. Analyze the school assignment problem
    console.log('\n🔍 Step 5: Analyzing current student school assignments...');
    
    // Get all students with their current school assignments
    const { data: students, error: allStudentsError } = await supabase
      .from('students')
      .select('aeries_student_id, school_id, grade_level')
      .limit(100);

    if (allStudentsError) {
      throw new Error(`Failed to get students: ${allStudentsError.message}`);
    }

    // Check what attendance records say about these students' schools
    const studentIds = students.map(s => s.aeries_student_id);
    const { data: studentAttendance, error: studentAttendanceError } = await supabase
      .from('attendance_records')
      .select('aeries_student_id, school_code, school_id')
      .in('aeries_student_id', studentIds);

    if (studentAttendanceError) {
      throw new Error(`Failed to get student attendance: ${studentAttendanceError.message}`);
    }

    console.log('✅ Comparing student assignments vs attendance records:');
    
    // Create lookup for attendance school assignments
    const attendanceSchoolAssignments = {};
    studentAttendance.forEach(record => {
      if (!attendanceSchoolAssignments[record.aeries_student_id]) {
        attendanceSchoolAssignments[record.aeries_student_id] = {
          school_codes: new Set(),
          school_ids: new Set()
        };
      }
      attendanceSchoolAssignments[record.aeries_student_id].school_codes.add(record.school_code);
      attendanceSchoolAssignments[record.aeries_student_id].school_ids.add(record.school_id);
    });

    let correctAssignments = 0;
    let incorrectAssignments = 0;
    let noAttendanceData = 0;

    students.slice(0, 20).forEach(student => {
      const attendanceData = attendanceSchoolAssignments[student.aeries_student_id];
      
      if (!attendanceData) {
        noAttendanceData++;
        console.log(`   ⚠️  Student ${student.aeries_student_id}: No attendance data`);
        return;
      }

      const attendanceSchoolIds = Array.from(attendanceData.school_ids);
      const attendanceSchoolCodes = Array.from(attendanceData.school_codes);
      
      if (attendanceSchoolIds.includes(student.school_id)) {
        correctAssignments++;
        console.log(`   ✅ Student ${student.aeries_student_id}: Correct assignment (${student.school_id.substring(0, 8)}...)`);
      } else {
        incorrectAssignments++;
        console.log(`   ❌ Student ${student.aeries_student_id}: Incorrect assignment`);
        console.log(`       Students table: ${student.school_id.substring(0, 8)}...`);
        console.log(`       Attendance records: ${attendanceSchoolIds.map(id => id.substring(0, 8) + '...').join(', ')}`);
        console.log(`       Attendance school codes: ${attendanceSchoolCodes.join(', ')}`);
      }
    });

    console.log(`\n📊 Assignment Analysis: ${correctAssignments} correct, ${incorrectAssignments} incorrect, ${noAttendanceData} no data`);

    // 6. Determine the correct mapping approach
    console.log('\n🔧 Step 6: Determining correct school mapping approach...');
    
    if (matchingCodes.length > 0) {
      console.log('✅ SOLUTION FOUND: Use aeries_school_code for mapping');
      console.log('   Attendance records school_code matches schools.aeries_school_code');
      console.log('   Student import should map using this relationship');
      
      // Show the correct mapping
      console.log('\n📋 Correct school code mapping:');
      uniqueAttendanceCodes.forEach(attendanceCode => {
        const matchingSchool = schools.find(s => s.aeries_school_code === attendanceCode);
        if (matchingSchool) {
          console.log(`   Attendance code "${attendanceCode}" → ${matchingSchool.school_name} (${matchingSchool.id.substring(0, 8)}...)`);
        } else {
          console.log(`   Attendance code "${attendanceCode}" → NO MATCHING SCHOOL`);
        }
      });
    } else {
      console.log('⚠️  No direct mapping found between attendance school_code and aeries_school_code');
    }

    // 7. Check if there are students assigned to wrong schools that should be reassigned
    console.log('\n🔄 Step 7: Identifying students that need school reassignment...');
    
    const reassignmentNeeded = {};
    
    studentAttendance.forEach(record => {
      const correctSchool = schools.find(s => s.aeries_school_code === record.school_code);
      if (correctSchool && record.school_id !== correctSchool.id) {
        if (!reassignmentNeeded[record.aeries_student_id]) {
          reassignmentNeeded[record.aeries_student_id] = {
            current_school_id: record.school_id,
            correct_school_id: correctSchool.id,
            correct_school_name: correctSchool.school_name,
            attendance_school_code: record.school_code
          };
        }
      }
    });

    const studentsNeedingReassignment = Object.keys(reassignmentNeeded).length;
    console.log(`✅ Students needing school reassignment: ${studentsNeedingReassignment}`);
    
    if (studentsNeedingReassignment > 0) {
      console.log('   Sample reassignments needed:');
      Object.entries(reassignmentNeeded).slice(0, 5).forEach(([studentId, assignment]) => {
        console.log(`     Student ${studentId}:`);
        console.log(`       Current: ${assignment.current_school_id.substring(0, 8)}...`);
        console.log(`       Should be: ${assignment.correct_school_name} (${assignment.correct_school_id.substring(0, 8)}...)`);
        console.log(`       Based on attendance school code: ${assignment.attendance_school_code}`);
      });
    }

    // 8. Recommendations
    console.log('\n💡 Recommendations:');
    console.log('===================');
    
    if (matchingCodes.length > 0) {
      console.log('1. ✅ USE aeries_school_code for school mapping');
      console.log('2. 🔧 Update student import logic to map students using attendance_records.school_code → schools.aeries_school_code');
      console.log('3. 🔄 Reassign existing students to correct schools based on their attendance records');
      console.log('4. 🧪 Test the corrected mapping with a small batch before full sync');
    } else {
      console.log('1. ⚠️  Investigate why aeries_school_code doesn\'t match attendance school_code');
      console.log('2. 🔍 Check if there\'s another field or mapping needed');
      console.log('3. 📞 Verify with Aeries API documentation for correct school code format');
    }

  } catch (error) {
    console.error('\n❌ Error checking aeries school code:', error);
  }
}

// Run the check
if (require.main === module) {
  checkAeriesSchoolCode().then(() => {
    console.log('\n✅ Aeries school code check complete!');
    process.exit(0);
  }).catch(error => {
    console.error('\n❌ Aeries school code check failed:', error);
    process.exit(1);
  });
}

module.exports = { checkAeriesSchoolCode };