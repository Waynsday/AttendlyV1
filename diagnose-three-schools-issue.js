#!/usr/bin/env node

/**
 * Diagnose the specific issue with Heritage, Mountain View, and Romoland Elementary
 * These were the schools affected by school code mismatch (001, 002, 003 -> 1, 2, 3)
 * Check if attendance_records table is the source of the problem
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function diagnoseThreeSchoolsIssue() {
  console.log('🔍 Diagnosing Heritage, Mountain View, and Romoland Elementary school data\n');
  
  try {
    // 1. Get the three affected schools
    console.log('🏫 Step 1: Getting the three affected schools...');
    const { data: affectedSchools, error: schoolsError } = await supabase
      .from('schools')
      .select('id, school_name, aeries_school_code')
      .in('school_name', [
        'Heritage Elementary School',
        'Mountain View Elementary School', 
        'Romoland Elementary School'
      ])
      .order('school_name');

    if (schoolsError) {
      throw new Error(`Failed to get schools: ${schoolsError.message}`);
    }

    console.log(`✅ Found ${affectedSchools.length} affected schools:`);
    affectedSchools.forEach(school => {
      console.log(`   ${school.school_name} - Aeries Code: ${school.aeries_school_code} - ID: ${school.id.substring(0, 8)}...`);
    });

    // 2. Check attendance_records for the corrected school codes (1, 2, 3)
    console.log('\n📊 Step 2: Checking attendance_records for corrected school codes...');
    const targetCodes = ['1', '2', '3'];
    
    for (const code of targetCodes) {
      const { data: attendanceCount, error: attendanceError } = await supabase
        .from('attendance_records')
        .select('aeries_student_id', { count: 'exact' })
        .eq('school_code', code);

      if (attendanceError) {
        console.log(`   ❌ Error checking school code ${code}: ${attendanceError.message}`);
      } else {
        const school = affectedSchools.find(s => s.aeries_school_code === code);
        const schoolName = school ? school.school_name : 'Unknown School';
        console.log(`   School code ${code} (${schoolName}): ${attendanceCount || 0} attendance records`);
      }
    }

    // 3. Check if students are assigned to these schools in students table
    console.log('\n👥 Step 3: Checking student assignments for these schools...');
    
    for (const school of affectedSchools) {
      const { data: students, error: studentsError } = await supabase
        .from('students')
        .select('aeries_student_id, grade_level')
        .eq('school_id', school.id);

      if (studentsError) {
        console.log(`   ❌ Error getting students for ${school.school_name}: ${studentsError.message}`);
      } else {
        console.log(`   ${school.school_name}: ${students.length} students enrolled`);
        
        if (students.length > 0) {
          // Show grade distribution
          const gradeCounts = {};
          students.forEach(student => {
            const grade = student.grade_level;
            gradeCounts[grade] = (gradeCounts[grade] || 0) + 1;
          });
          console.log(`     Grade distribution: ${Object.entries(gradeCounts).map(([grade, count]) => `${grade}: ${count}`).join(', ')}`);
          
          // Check if these students have attendance records
          const studentIds = students.map(s => s.aeries_student_id);
          const { data: studentAttendance, error: attendanceError } = await supabase
            .from('attendance_records')
            .select('aeries_student_id, school_code, attendance_date, is_present')
            .in('aeries_student_id', studentIds);

          if (!attendanceError) {
            console.log(`     Attendance records for these students: ${studentAttendance.length}`);
            
            // Group by school_code to see where their attendance is recorded
            const attendanceByCode = {};
            studentAttendance.forEach(record => {
              if (!attendanceByCode[record.school_code]) {
                attendanceByCode[record.school_code] = [];
              }
              attendanceByCode[record.school_code].push(record);
            });
            
            console.log(`     Attendance records by school code:`);
            Object.entries(attendanceByCode).forEach(([code, records]) => {
              console.log(`       School code ${code}: ${records.length} records`);
            });
          }
        }
      }
    }

    // 4. Check what the dashboard views show for these schools
    console.log('\n📈 Step 4: Checking dashboard data for these schools...');
    
    // Check grade_attendance_summaries
    for (const school of affectedSchools) {
      const { data: gradeSummaries, error: summariesError } = await supabase
        .from('grade_attendance_summaries')
        .select('grade_level, total_students, attendance_rate, chronic_absentees')
        .eq('school_id', school.id);

      if (summariesError) {
        console.log(`   ❌ Error getting grade summaries for ${school.school_name}: ${summariesError.message}`);
      } else {
        console.log(`   ${school.school_name} in grade_attendance_summaries: ${gradeSummaries.length} records`);
        if (gradeSummaries.length > 0) {
          gradeSummaries.forEach(summary => {
            console.log(`     Grade ${summary.grade_level}: ${summary.total_students} students, ${summary.attendance_rate}% attendance, ${summary.chronic_absentees} chronic absentees`);
          });
        } else {
          console.log(`     ⚠️  NO grade summaries found for this school!`);
        }
      }
    }

    // Check timeline summary
    for (const school of affectedSchools) {
      const { data: timelineData, error: timelineError } = await supabase
        .from('grade_attendance_timeline_summary')
        .select('summary_date, grade_level, total_students, students_present, attendance_rate')
        .eq('school_id', school.id)
        .limit(10);

      if (timelineError) {
        console.log(`   ❌ Error getting timeline for ${school.school_name}: ${timelineError.message}`);
      } else {
        console.log(`   ${school.school_name} in timeline summary: ${timelineData.length} records`);
        if (timelineData.length > 0) {
          console.log(`     Sample timeline data:`);
          timelineData.slice(0, 3).forEach(record => {
            console.log(`       ${record.summary_date} Grade ${record.grade_level}: ${record.total_students} students, ${record.students_present} present (${record.attendance_rate}%)`);
          });
        } else {
          console.log(`     ⚠️  NO timeline data found for this school!`);
        }
      }
    }

    // 5. Investigate the root cause - check if the problem is in the join logic
    console.log('\n🔍 Step 5: Testing the join logic manually...');
    
    for (const school of affectedSchools) {
      console.log(`\nTesting ${school.school_name} (aeries_school_code: ${school.aeries_school_code}):`);
      
      // Manual join test
      const { data: joinTest, error: joinError } = await supabase
        .from('students')
        .select(`
          aeries_student_id,
          grade_level,
          school_id,
          attendance_records!inner(aeries_student_id, school_code, attendance_date, is_present)
        `)
        .eq('school_id', school.id)
        .eq('attendance_records.school_code', school.aeries_school_code)
        .limit(5);

      if (joinError) {
        console.log(`   ❌ Join test failed: ${joinError.message}`);
        
        // Try alternative approach - manual join
        const { data: students, error: studentsError } = await supabase
          .from('students')
          .select('aeries_student_id, grade_level')
          .eq('school_id', school.id)
          .limit(10);

        if (!studentsError && students.length > 0) {
          const studentIds = students.map(s => s.aeries_student_id);
          const { data: attendanceForStudents, error: attendanceError } = await supabase
            .from('attendance_records')
            .select('aeries_student_id, school_code, attendance_date, is_present')
            .in('aeries_student_id', studentIds)
            .eq('school_code', school.aeries_school_code);

          if (!attendanceError) {
            console.log(`   Manual join result: ${attendanceForStudents.length} attendance records found for students assigned to this school with matching school code`);
            
            if (attendanceForStudents.length === 0) {
              console.log(`   🚨 ISSUE FOUND: Students assigned to ${school.school_name} have NO attendance records with school code ${school.aeries_school_code}`);
              
              // Check what school codes these students DO have
              const { data: allAttendance, error: allAttendanceError } = await supabase
                .from('attendance_records')
                .select('school_code')
                .in('aeries_student_id', studentIds);
                
              if (!allAttendanceError) {
                const foundCodes = [...new Set(allAttendance.map(r => r.school_code))];
                console.log(`   Their attendance records use school codes: ${foundCodes.join(', ')}`);
              }
            }
          }
        }
      } else if (joinTest) {
        console.log(`   ✅ Join successful: ${joinTest.length} student-attendance combinations found`);
      }
    }

    // 6. Summary and diagnosis
    console.log('\n💡 Diagnosis Summary:');
    console.log('====================');
    
    console.log('The issue with Heritage, Mountain View, and Romoland Elementary showing few students with 0 absences suggests:');
    console.log('1. 🔍 Students may be assigned to these schools in the students table');
    console.log('2. 🔍 But their attendance records may still have incorrect school codes');
    console.log('3. 🔍 OR the school code cleanup (001->1, 002->2, 003->3) may not have affected the right records');
    console.log('4. 🔍 OR these students may not have any attendance records at all');
    
    console.log('\n🔧 Recommended next steps:');
    console.log('1. Verify the school code cleanup actually changed the right records');
    console.log('2. Check if students are incorrectly assigned to these schools');
    console.log('3. Investigate if attendance data exists for these schools under different codes');

  } catch (error) {
    console.error('\n❌ Error diagnosing three schools issue:', error);
  }
}

// Run the diagnosis
if (require.main === module) {
  diagnoseThreeSchoolsIssue().then(() => {
    console.log('\n✅ Three schools diagnosis complete!');
    process.exit(0);
  }).catch(error => {
    console.error('\n❌ Three schools diagnosis failed:', error);
    process.exit(1);
  });
}

module.exports = { diagnoseThreeSchoolsIssue };