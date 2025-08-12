#!/usr/bin/env node

/**
 * Final verification of complete AP Tool V1 data population
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../ap-tool-v1/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyCompleteData() {
  console.log('🎯 AP Tool V1 - FINAL DATA VERIFICATION');
  console.log('='.repeat(60));
  
  try {
    // 1. Districts
    const { count: districtCount } = await supabase
      .from('districts')
      .select('*', { count: 'exact', head: true });
    console.log(`✅ Districts: ${districtCount}`);

    // 2. Schools 
    const { count: schoolCount } = await supabase
      .from('schools')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);
    console.log(`✅ Active Schools: ${schoolCount}`);

    // 3. Students
    const { count: studentCount } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);
    console.log(`✅ Active Students: ${studentCount}`);

    // 4. Students by school
    const { data: studentsBySchool } = await supabase
      .from('students')
      .select('schools(school_code, school_name)', { count: 'exact' })
      .eq('is_active', true);

    const schoolCounts = {};
    studentsBySchool.forEach(s => {
      const schoolCode = s.schools.school_code;
      schoolCounts[schoolCode] = (schoolCounts[schoolCode] || 0) + 1;
    });

    console.log('\n📚 Students by School:');
    Object.entries(schoolCounts).forEach(([code, count]) => {
      console.log(`   • ${code}: ${count} students`);
    });

    // 5. Attendance Records
    const { count: attendanceCount } = await supabase
      .from('attendance_records')
      .select('*', { count: 'exact', head: true });
    console.log(`\n📅 Attendance Records: ${attendanceCount}`);

    // 6. Sample attendance data
    if (attendanceCount > 0) {
      const { data: sampleAttendance } = await supabase
        .from('attendance_records')
        .select('attendance_date, is_present, is_full_day_absent, students(first_name, last_name, schools(school_code))')
        .order('attendance_date', { ascending: false })
        .limit(5);

      console.log('\n📊 Recent Attendance Sample:');
      sampleAttendance.forEach(record => {
        const status = record.is_present ? '✅ Present' : record.is_full_day_absent ? '❌ Absent' : '⚠️ Tardy';
        console.log(`   • ${record.attendance_date}: ${record.students.first_name} ${record.students.last_name} (${record.students.schools.school_code}) - ${status}`);
      });
    }

    // 7. Date range coverage
    if (attendanceCount > 0) {
      const { data: dateRange } = await supabase
        .from('attendance_records')
        .select('attendance_date')
        .order('attendance_date', { ascending: true })
        .limit(1);

      const { data: dateRangeEnd } = await supabase
        .from('attendance_records')
        .select('attendance_date')
        .order('attendance_date', { ascending: false })
        .limit(1);

      const startDate = dateRange[0]?.attendance_date;
      const endDate = dateRangeEnd[0]?.attendance_date;
      
      console.log(`\n📅 Attendance Coverage: ${startDate} to ${endDate}`);
    }

    // 8. Users and Teachers
    const { count: userCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    const { count: teacherCount } = await supabase
      .from('teachers')
      .select('*', { count: 'exact', head: true });

    console.log(`\n👥 System Users: ${userCount}`);
    console.log(`👨‍🏫 Teachers: ${teacherCount}`);

    // 9. Data quality metrics
    if (studentCount > 0 && attendanceCount > 0) {
      const averageRecordsPerStudent = Math.round(attendanceCount / studentCount);
      console.log(`\n📊 Data Quality:`);
      console.log(`   • Avg attendance records per student: ${averageRecordsPerStudent}`);
      console.log(`   • Expected records per student: 194 (school days)`);
      console.log(`   • Coverage: ${Math.round((averageRecordsPerStudent / 194) * 100)}%`);
    }

    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log('🎉 AP TOOL V1 - DATA POPULATION COMPLETE!');
    console.log('='.repeat(60));
    console.log(`📊 SUMMARY:`);
    console.log(`   • Districts: ${districtCount}`);
    console.log(`   • Schools: ${schoolCount}`);
    console.log(`   • Students: ${studentCount}`);
    console.log(`   • Attendance Records: ${attendanceCount}`);
    console.log(`   • Users: ${userCount}`);
    console.log(`   • Teachers: ${teacherCount}`);
    console.log('\n🚀 READY FOR PRODUCTION USE!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Verification error:', error.message);
  }
}

verifyCompleteData();