#!/usr/bin/env node

/**
 * Investigation script to understand why student_id joins aren't working
 * between attendance_records and students tables
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function investigateJoinMismatch() {
  console.log('🔍 Investigating student_id join mismatch\n');
  
  try {
    // 1. Get a sample of unique student_ids from attendance_records
    console.log('📊 Sample unique student_ids from attendance_records:');
    const { data: attendanceStudents, error: attendanceError } = await supabase
      .from('attendance_records')
      .select('student_id')
      .limit(2000);

    if (attendanceError) {
      console.log(`❌ Error: ${attendanceError.message}`);
      return;
    }

    const uniqueAttendanceStudents = [...new Set(attendanceStudents.map(r => r.student_id))];
    console.log(`  Found ${uniqueAttendanceStudents.length} unique student_ids in attendance sample`);
    console.log(`  First 5: ${uniqueAttendanceStudents.slice(0, 5).join(', ')}`);

    // 2. Get all student_ids from students table
    console.log('\n📊 All student_ids from students table:');
    const { data: allStudents, error: studentsError } = await supabase
      .from('students')
      .select('id')
      .limit(3000);

    if (studentsError) {
      console.log(`❌ Error: ${studentsError.message}`);
      return;
    }

    const allStudentIds = allStudents.map(s => s.id);
    console.log(`  Found ${allStudentIds.length} student records`);
    console.log(`  First 5: ${allStudentIds.slice(0, 5).join(', ')}`);

    // 3. Check for matches
    console.log('\n🔍 Checking for matches:');
    const matches = uniqueAttendanceStudents.filter(id => allStudentIds.includes(id));
    console.log(`  Matches: ${matches.length} out of ${uniqueAttendanceStudents.length} attendance student_ids`);
    
    if (matches.length > 0) {
      console.log(`  Sample matches: ${matches.slice(0, 3).join(', ')}`);
      
      // 4. Get full records for matched students
      console.log('\n📋 Sample matched student records:');
      const { data: matchedStudents, error: matchedError } = await supabase
        .from('students')
        .select('id, aeries_student_id, grade_level, school_id')
        .in('id', matches.slice(0, 5));
        
      if (!matchedError && matchedStudents) {
        matchedStudents.forEach(student => {
          console.log(`    ID: ${student.id}, Aeries: ${student.aeries_student_id}, Grade: ${student.grade_level}, School: ${student.school_id}`);
        });
      }
      
      // 5. Get attendance records for these matched students
      console.log('\n📊 Sample attendance data for matched students:');
      const { data: matchedAttendance, error: matchedAttError } = await supabase
        .from('attendance_records')
        .select('student_id, school_id, attendance_date, is_present, aeries_student_id')
        .in('student_id', matches.slice(0, 2))
        .limit(10);
        
      if (!matchedAttError && matchedAttendance) {
        matchedAttendance.forEach(record => {
          console.log(`    Student: ${record.student_id}, Aeries: ${record.aeries_student_id}, Date: ${record.attendance_date}, Present: ${record.is_present}`);
        });
        
        // 6. Now recalculate with these matched records
        console.log('\n🔄 Testing recalculation with matched data:');
        await testRecalculationWithMatches(matches.slice(0, 10));
      }
    } else {
      console.log('  ❌ No matches found!');
      
      // Let's check if there's a data pattern issue
      console.log('\n🔬 Analyzing data patterns:');
      
      // Check attendance records by date
      const { data: attendanceDates, error: datesError } = await supabase
        .from('attendance_records')
        .select('attendance_date, student_id')
        .order('attendance_date', { ascending: true })
        .limit(10);
        
      if (!datesError && attendanceDates) {
        console.log(`  Latest attendance records:`);
        attendanceDates.forEach(record => {
          console.log(`    Date: ${record.attendance_date}, Student: ${record.student_id}`);
        });
      }
      
      // Check students table for patterns
      const { data: studentsPattern, error: patternError } = await supabase
        .from('students')
        .select('id, aeries_student_id, created_at')
        .order('created_at', { ascending: false })
        .limit(5);
        
      if (!patternError && studentsPattern) {
        console.log(`  Latest student records:`);
        studentsPattern.forEach(student => {
          console.log(`    ID: ${student.id}, Aeries: ${student.aeries_student_id}, Created: ${student.created_at}`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Error during investigation:', error);
  }
}

async function testRecalculationWithMatches(matchedStudentIds) {
  try {
    // Get attendance data for matched students
    const { data: attendanceData, error } = await supabase
      .from('attendance_records')
      .select('student_id, school_id, attendance_date, is_present')
      .in('student_id', matchedStudentIds);

    if (error) {
      console.log(`  ❌ Error getting attendance data: ${error.message}`);
      return;
    }

    // Get student data
    const { data: studentsData, error: studentsError } = await supabase
      .from('students')
      .select('id, grade_level, school_id')
      .in('id', matchedStudentIds);

    if (studentsError) {
      console.log(`  ❌ Error getting student data: ${studentsError.message}`);
      return;
    }

    // Get school data
    const schoolIds = [...new Set(studentsData.map(s => s.school_id))];
    const { data: schoolsData, error: schoolsError } = await supabase
      .from('schools')
      .select('id, school_name')
      .in('id', schoolIds);

    if (schoolsError) {
      console.log(`  ❌ Error getting school data: ${schoolsError.message}`);
      return;
    }

    // Create lookups
    const studentLookup = {};
    studentsData.forEach(student => {
      studentLookup[student.id] = {
        grade_level: student.grade_level,
        school_id: student.school_id
      };
    });

    const schoolLookup = {};
    schoolsData.forEach(school => {
      schoolLookup[school.id] = school.school_name;
    });

    console.log(`  ✅ Found ${attendanceData.length} attendance records for ${matchedStudentIds.length} students`);
    console.log(`  ✅ Found ${studentsData.length} student records`);
    console.log(`  ✅ Found ${schoolsData.length} school records`);

    // Calculate summaries
    const summaries = {};
    let matched = 0;
    let unmatched = 0;

    attendanceData.forEach(record => {
      const studentData = studentLookup[record.student_id];
      
      if (!studentData) {
        unmatched++;
        return;
      }
      
      matched++;
      const key = `${record.school_id}_${studentData.grade_level}`;
      
      if (!summaries[key]) {
        summaries[key] = {
          school_id: record.school_id,
          school_name: schoolLookup[record.school_id] || 'Unknown',
          grade_level: studentData.grade_level,
          students: new Set(),
          total_records: 0,
          present_records: 0
        };
      }
      
      summaries[key].students.add(record.student_id);
      summaries[key].total_records++;
      if (record.is_present) {
        summaries[key].present_records++;
      }
    });

    console.log(`  📊 Join result: ${matched} matched, ${unmatched} unmatched`);
    
    if (Object.keys(summaries).length > 0) {
      console.log(`  🎯 Successfully calculated ${Object.keys(summaries).length} grade summaries:`);
      Object.entries(summaries).forEach(([key, summary]) => {
        const attendanceRate = summary.total_records > 0 ? 
          (summary.present_records / summary.total_records) * 100 : 0;
        console.log(`    ${summary.school_name} Grade ${summary.grade_level}: ${summary.students.size} students, ${attendanceRate.toFixed(1)}% attendance`);
      });
    }

  } catch (err) {
    console.log(`  ❌ Error in test recalculation: ${err.message}`);
  }
}

// Run the investigation
if (require.main === module) {
  investigateJoinMismatch().then(() => {
    console.log('\n✅ Investigation complete!');
    process.exit(0);
  }).catch(error => {
    console.error('\n❌ Investigation failed:', error);
    process.exit(1);
  });
}

module.exports = { investigateJoinMismatch };