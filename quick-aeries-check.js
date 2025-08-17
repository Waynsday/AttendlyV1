#!/usr/bin/env node

/**
 * Quick check to see if aeries_student_id values actually match between tables
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function quickAeriesCheck() {
  console.log('🔍 Quick check of aeries_student_id matches\n');
  
  try {
    // Get sample aeries_student_id from students
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('aeries_student_id')
      .limit(10);

    if (studentsError) {
      console.log(`❌ Error getting students: ${studentsError.message}`);
      return;
    }

    console.log('📊 Sample aeries_student_id from students:');
    students.forEach((student, i) => {
      console.log(`  ${i + 1}. ${student.aeries_student_id}`);
    });

    // Get a few specific attendance records for these students
    const aeriesIds = students.map(s => s.aeries_student_id);
    console.log(`\n🔍 Looking for attendance records with these aeries_student_id values...`);
    
    const { data: attendance, error: attendanceError } = await supabase
      .from('attendance_records')
      .select('aeries_student_id, attendance_date, is_present')
      .in('aeries_student_id', aeriesIds)
      .limit(20);

    if (attendanceError) {
      console.log(`❌ Error getting attendance: ${attendanceError.message}`);
      return;
    }

    console.log(`✅ Found ${attendance.length} attendance records for these students:`);
    attendance.forEach((record, i) => {
      console.log(`  ${i + 1}. Student ${record.aeries_student_id}: ${record.attendance_date} - Present: ${record.is_present}`);
    });

    // Quick summary by student
    const summary = {};
    attendance.forEach(record => {
      if (!summary[record.aeries_student_id]) {
        summary[record.aeries_student_id] = { total: 0, present: 0 };
      }
      summary[record.aeries_student_id].total++;
      if (record.is_present) {
        summary[record.aeries_student_id].present++;
      }
    });

    console.log(`\n📊 Attendance summary for these students:`);
    Object.entries(summary).forEach(([aeriesId, stats]) => {
      const rate = stats.total > 0 ? ((stats.present / stats.total) * 100).toFixed(1) : 'N/A';
      console.log(`  Student ${aeriesId}: ${stats.present}/${stats.total} present (${rate}%)`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the check
if (require.main === module) {
  quickAeriesCheck().then(() => {
    console.log('\n✅ Quick check complete!');
    process.exit(0);
  }).catch(error => {
    console.error('\n❌ Quick check failed:', error);
    process.exit(1);
  });
}

module.exports = { quickAeriesCheck };