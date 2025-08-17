#!/usr/bin/env node

/**
 * Assess school filter functionality and investigate school ID matching
 * Focus on Heritage, Mountain View, and Romoland Elementary schools
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function assessSchoolFilterIssue() {
  console.log('🔍 Assessing school filter functionality and school ID matching\n');
  
  try {
    // 1. Get all schools from schools table
    console.log('🏫 Step 1: Examining schools table...');
    const { data: schools, error: schoolsError } = await supabase
      .from('schools')
      .select('id, school_name, school_code')
      .order('school_name');

    if (schoolsError) {
      throw new Error(`Failed to get schools: ${schoolsError.message}`);
    }

    console.log(`✅ Found ${schools.length} schools in schools table:`);
    schools.forEach((school, i) => {
      console.log(`  ${i + 1}. ${school.school_name} (ID: ${school.id.substring(0, 8)}..., Code: ${school.school_code})`);
    });

    // 2. Check which schools have students
    console.log('\n👥 Step 2: Checking student enrollment by school...');
    const { data: studentCounts, error: studentsError } = await supabase
      .from('students')
      .select('school_id')
      .not('school_id', 'is', null);

    if (studentsError) {
      throw new Error(`Failed to get student counts: ${studentsError.message}`);
    }

    const studentsBySchool = {};
    studentCounts.forEach(student => {
      if (!studentsBySchool[student.school_id]) {
        studentsBySchool[student.school_id] = 0;
      }
      studentsBySchool[student.school_id]++;
    });

    console.log('✅ Student enrollment by school:');
    schools.forEach(school => {
      const studentCount = studentsBySchool[school.id] || 0;
      console.log(`  ${school.school_name}: ${studentCount} students`);
    });

    // 3. Check which schools have attendance records
    console.log('\n📊 Step 3: Checking attendance records by school...');
    const { data: attendanceCounts, error: attendanceError } = await supabase
      .from('attendance_records')
      .select('school_id')
      .not('school_id', 'is', null);

    if (attendanceError) {
      throw new Error(`Failed to get attendance counts: ${attendanceError.message}`);
    }

    const attendanceBySchool = {};
    attendanceCounts.forEach(record => {
      if (!attendanceBySchool[record.school_id]) {
        attendanceBySchool[record.school_id] = 0;
      }
      attendanceBySchool[record.school_id]++;
    });

    console.log('✅ Attendance records by school:');
    schools.forEach(school => {
      const attendanceCount = attendanceBySchool[school.id] || 0;
      console.log(`  ${school.school_name}: ${attendanceCount} attendance records`);
    });

    // 4. Focus on the problematic schools
    console.log('\n🔍 Step 4: Detailed analysis of Heritage, Mountain View, and Romoland Elementary...');
    const problematicSchools = schools.filter(school => 
      school.school_name.includes('Heritage') || 
      school.school_name.includes('Mountain View') || 
      (school.school_name.includes('Romoland') && school.school_name.includes('Elementary'))
    );

    for (const school of problematicSchools) {
      console.log(`\n📋 Analysis for ${school.school_name}:`);
      console.log(`   School ID: ${school.id}`);
      console.log(`   Students: ${studentsBySchool[school.id] || 0}`);
      console.log(`   Attendance records: ${attendanceBySchool[school.id] || 0}`);

      // Get sample students for this school
      const { data: schoolStudents, error: schoolStudentsError } = await supabase
        .from('students')
        .select('aeries_student_id, grade_level')
        .eq('school_id', school.id)
        .limit(10);

      if (!schoolStudentsError && schoolStudents) {
        console.log(`   Sample students (${schoolStudents.length}):`);
        schoolStudents.forEach(student => {
          console.log(`     Aeries ID: ${student.aeries_student_id}, Grade: ${student.grade_level}`);
        });

        // Check if these students have attendance records
        if (schoolStudents.length > 0) {
          const aeriesIds = schoolStudents.map(s => s.aeries_student_id);
          const { data: studentAttendance, error: studentAttendanceError } = await supabase
            .from('attendance_records')
            .select('aeries_student_id, attendance_date, is_present')
            .in('aeries_student_id', aeriesIds)
            .limit(20);

          if (!studentAttendanceError) {
            console.log(`   Attendance records for these students: ${studentAttendance.length}`);
            if (studentAttendance.length > 0) {
              console.log(`   Sample attendance:`);
              studentAttendance.slice(0, 5).forEach(record => {
                console.log(`     Student ${record.aeries_student_id}: ${record.attendance_date} - Present: ${record.is_present}`);
              });
            } else {
              console.log(`   ⚠️  NO attendance records found for these students!`);
            }
          }
        }
      }
    }

    // 5. Check grade_attendance_timeline_summary for these schools
    console.log('\n📈 Step 5: Checking timeline summary for problematic schools...');
    for (const school of problematicSchools) {
      const { data: timelineData, error: timelineError } = await supabase
        .from('grade_attendance_timeline_summary')
        .select('summary_date, grade_level, total_students, students_present, attendance_rate')
        .eq('school_id', school.id)
        .limit(10);

      if (!timelineError) {
        console.log(`\n${school.school_name} in timeline summary: ${timelineData.length} records`);
        if (timelineData.length > 0) {
          console.log('   Sample timeline data:');
          timelineData.forEach(record => {
            console.log(`     ${record.summary_date} Grade ${record.grade_level}: ${record.total_students} students, ${record.students_present} present (${record.attendance_rate}%)`);
          });
        } else {
          console.log('   ⚠️  NO timeline records found for this school!');
        }
      }
    }

    // 6. Check if school IDs in different tables match
    console.log('\n🔗 Step 6: Verifying school ID consistency across tables...');
    
    const schoolIdsInStudents = [...new Set(Object.keys(studentsBySchool))];
    const schoolIdsInAttendance = [...new Set(Object.keys(attendanceBySchool))];
    const schoolIdsInSchoolsTable = schools.map(s => s.id);

    console.log(`School IDs in schools table: ${schoolIdsInSchoolsTable.length}`);
    console.log(`School IDs in students table: ${schoolIdsInStudents.length}`);
    console.log(`School IDs in attendance_records: ${schoolIdsInAttendance.length}`);

    // Find mismatches
    const studentsNotInSchools = schoolIdsInStudents.filter(id => !schoolIdsInSchoolsTable.includes(id));
    const attendanceNotInSchools = schoolIdsInAttendance.filter(id => !schoolIdsInSchoolsTable.includes(id));
    const schoolsWithoutStudents = schoolIdsInSchoolsTable.filter(id => !schoolIdsInStudents.includes(id));
    const schoolsWithoutAttendance = schoolIdsInSchoolsTable.filter(id => !schoolIdsInAttendance.includes(id));

    if (studentsNotInSchools.length > 0) {
      console.log(`⚠️  Students table has school IDs not in schools table: ${studentsNotInSchools.length}`);
    }
    if (attendanceNotInSchools.length > 0) {
      console.log(`⚠️  Attendance records have school IDs not in schools table: ${attendanceNotInSchools.length}`);
    }
    if (schoolsWithoutStudents.length > 0) {
      console.log(`⚠️  Schools with no students: ${schoolsWithoutStudents.length}`);
      schoolsWithoutStudents.forEach(id => {
        const school = schools.find(s => s.id === id);
        console.log(`     ${school?.school_name || 'Unknown'} (${id.substring(0, 8)}...)`);
      });
    }
    if (schoolsWithoutAttendance.length > 0) {
      console.log(`⚠️  Schools with no attendance records: ${schoolsWithoutAttendance.length}`);
      schoolsWithoutAttendance.forEach(id => {
        const school = schools.find(s => s.id === id);
        console.log(`     ${school?.school_name || 'Unknown'} (${id.substring(0, 8)}...)`);
      });
    }

    console.log('\n💡 Summary and Recommendations:');
    console.log('=====================================');
    
    if (schoolsWithoutAttendance.length > 0) {
      console.log('🚨 ISSUE IDENTIFIED: Some schools have no attendance records');
      console.log('   This explains why Heritage, Mountain View, and Romoland Elementary show 0 absences');
      console.log('   These schools may be using different school codes in the Aeries API sync');
    }
    
    if (studentsNotInSchools.length > 0 || attendanceNotInSchools.length > 0) {
      console.log('🚨 ISSUE IDENTIFIED: School ID mismatches between tables');
      console.log('   This could cause filter functionality to fail');
    }

    problematicSchools.forEach(school => {
      const hasStudents = studentsBySchool[school.id] > 0;
      const hasAttendance = attendanceBySchool[school.id] > 0;
      
      if (hasStudents && !hasAttendance) {
        console.log(`🔧 RECOMMENDATION for ${school.school_name}:`);
        console.log('   - Check if school uses different school_code in Aeries API');
        console.log('   - Verify attendance sync configuration for this school');
        console.log('   - Consider manual attendance data import if needed');
      }
    });

  } catch (error) {
    console.error('\n❌ Error assessing school filter issue:', error);
  }
}

// Run the assessment
if (require.main === module) {
  assessSchoolFilterIssue().then(() => {
    console.log('\n✅ School filter assessment complete!');
    process.exit(0);
  }).catch(error => {
    console.error('\n❌ School filter assessment failed:', error);
    process.exit(1);
  });
}

module.exports = { assessSchoolFilterIssue };