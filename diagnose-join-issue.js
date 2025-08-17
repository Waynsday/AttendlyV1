#!/usr/bin/env node

/**
 * Diagnostic script to investigate why the join between attendance_records 
 * and students on aeries_student_id is not working
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function diagnoseJoinIssue() {
  console.log('🔍 Diagnosing aeries_student_id join issue\n');
  
  try {
    // 1. Sample aeries_student_id values from attendance_records
    console.log('📋 Sample aeries_student_id from attendance_records:');
    const { data: attendanceSample, error: attendanceError } = await supabase
      .from('attendance_records')
      .select('aeries_student_id, student_id, school_id')
      .not('aeries_student_id', 'is', null)
      .limit(10);

    if (attendanceError) {
      console.log(`❌ Error: ${attendanceError.message}`);
      return;
    }

    attendanceSample.forEach((record, i) => {
      console.log(`  ${i + 1}. aeries_student_id: "${record.aeries_student_id}" (type: ${typeof record.aeries_student_id})`);
    });

    // 2. Sample aeries_student_id values from students  
    console.log('\n📋 Sample aeries_student_id from students:');
    const { data: studentsSample, error: studentsError } = await supabase
      .from('students')
      .select('aeries_student_id, id, grade_level, school_id')
      .not('aeries_student_id', 'is', null)
      .limit(10);

    if (studentsError) {
      console.log(`❌ Error: ${studentsError.message}`);
      return;
    }

    studentsSample.forEach((record, i) => {
      console.log(`  ${i + 1}. aeries_student_id: "${record.aeries_student_id}" (type: ${typeof record.aeries_student_id})`);
    });

    // 3. Check for null values
    console.log('\n📊 Null/Empty aeries_student_id analysis:');
    
    const { count: attendanceTotal } = await supabase
      .from('attendance_records')
      .select('*', { count: 'exact', head: true });
      
    const { count: attendanceWithAeries } = await supabase
      .from('attendance_records')
      .select('*', { count: 'exact', head: true })
      .not('aeries_student_id', 'is', null)
      .neq('aeries_student_id', '');

    const { count: studentsTotal } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true });
      
    const { count: studentsWithAeries } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true })
      .not('aeries_student_id', 'is', null)
      .neq('aeries_student_id', '');

    console.log(`  Attendance Records: ${attendanceWithAeries}/${attendanceTotal} have aeries_student_id`);
    console.log(`  Student Records: ${studentsWithAeries}/${studentsTotal} have aeries_student_id`);

    // 4. Look for matching values
    console.log('\n🔍 Looking for matching aeries_student_id values...');
    
    if (attendanceSample.length > 0 && studentsSample.length > 0) {
      const attendanceIds = new Set(attendanceSample.map(r => r.aeries_student_id).filter(id => id));
      const studentIds = new Set(studentsSample.map(r => r.aeries_student_id).filter(id => id));
      
      const intersection = [...attendanceIds].filter(id => studentIds.has(id));
      console.log(`  Attendance sample IDs: [${Array.from(attendanceIds).slice(0, 5).join(', ')}...]`);
      console.log(`  Students sample IDs: [${Array.from(studentIds).slice(0, 5).join(', ')}...]`);
      console.log(`  Matching IDs in samples: ${intersection.length} (${intersection.slice(0, 3).join(', ')})`);
    }

    // 5. Try alternative join methods
    console.log('\n🔄 Trying alternative join approaches...');
    
    // Try using student_id directly
    console.log('  📊 Checking student_id relationship:');
    const { data: directJoinSample, error: directJoinError } = await supabase
      .from('attendance_records')
      .select('student_id')
      .limit(5);

    if (!directJoinError && directJoinSample.length > 0) {
      const studentIds = directJoinSample.map(r => r.student_id);
      console.log(`     Sample student_ids from attendance: [${studentIds.slice(0,2).join(', ')}...]`);
      
      // Check if these exist in students table
      const { data: studentsById, error: studentsByIdError } = await supabase
        .from('students')
        .select('id, aeries_student_id, grade_level')
        .in('id', studentIds);
        
      if (!studentsByIdError) {
        console.log(`     Found ${studentsById.length}/${studentIds.length} matching students by ID`);
        studentsById.forEach(student => {
          console.log(`       ID: ${student.id}, Aeries ID: ${student.aeries_student_id}, Grade: ${student.grade_level}`);
        });
      }
      
      // Also check some random students IDs to compare
      const { data: randomStudents, error: randomError } = await supabase
        .from('students')
        .select('id, aeries_student_id, grade_level')
        .limit(5);
        
      if (!randomError) {
        console.log(`     Sample student IDs from students table:`);
        randomStudents.forEach(student => {
          console.log(`       ID: ${student.id}, Aeries ID: ${student.aeries_student_id}, Grade: ${student.grade_level}`);
        });
      }
    }

    // 6. Data type and format analysis
    console.log('\n🔬 Data format analysis:');
    if (attendanceSample.length > 0) {
      const firstAttendance = attendanceSample[0].aeries_student_id;
      console.log(`  Attendance aeries_student_id example: "${firstAttendance}"`);
      console.log(`    Length: ${firstAttendance?.length || 0}`);
      console.log(`    Is numeric: ${!isNaN(firstAttendance)}`);
      console.log(`    Trimmed equals original: ${firstAttendance?.trim() === firstAttendance}`);
    }
    
    if (studentsSample.length > 0) {
      const firstStudent = studentsSample[0].aeries_student_id;
      console.log(`  Students aeries_student_id example: "${firstStudent}"`);
      console.log(`    Length: ${firstStudent?.length || 0}`);
      console.log(`    Is numeric: ${!isNaN(firstStudent)}`);
      console.log(`    Trimmed equals original: ${firstStudent?.trim() === firstStudent}`);
    }

  } catch (error) {
    console.error('❌ Error during diagnosis:', error);
  }
}

// Run the diagnosis
if (require.main === module) {
  diagnoseJoinIssue().then(() => {
    console.log('\n✅ Diagnosis complete!');
    process.exit(0);
  }).catch(error => {
    console.error('\n❌ Diagnosis failed:', error);
    process.exit(1);
  });
}

module.exports = { diagnoseJoinIssue };