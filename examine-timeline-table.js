#!/usr/bin/env node

/**
 * Examine grade_attendance_timeline_summary table structure and data
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function examineTimelineTable() {
  console.log('🔍 Examining grade_attendance_timeline_summary table\n');
  
  try {
    // Get sample data from timeline table
    console.log('📊 Current grade_attendance_timeline_summary data:');
    const { data, error, count } = await supabase
      .from('grade_attendance_timeline_summary')
      .select('*', { count: 'exact' })
      .order('summary_date, school_id, grade_level')
      .limit(10);

    if (error) {
      console.log(`❌ Error: ${error.message}`);
      return;
    }

    console.log(`✅ Found ${count} records in grade_attendance_timeline_summary\n`);
    
    if (data && data.length > 0) {
      // Show table structure
      console.log('📋 Table Structure:');
      const sampleRecord = data[0];
      Object.keys(sampleRecord).forEach(key => {
        const value = sampleRecord[key];
        const type = typeof value;
        console.log(`   ${key}: ${type} ${value !== null ? `(e.g., ${value})` : '(null)'}`);
      });
      
      console.log('\n📊 Sample Data:');
      console.log('Date       | School                  | Grade | Students | Present | Rate  | Absences');
      console.log('-----------|-------------------------|-------|----------|---------|-------|----------');
      
      data.forEach(record => {
        const date = String(record.summary_date || 'N/A').substring(0, 10);
        const school = String(record.school_name || 'Unknown').substring(0, 23).padEnd(23);
        const grade = String(record.grade_level || 'N/A').padEnd(5);
        const students = String(record.total_students || 0).padEnd(8);
        const present = String(record.students_present || 0).padEnd(7);
        const rate = record.attendance_rate ? `${record.attendance_rate}%` : 'N/A';
        const absences = String(record.daily_absences || 0).padEnd(8);
        console.log(`${date} | ${school} | ${grade} | ${students} | ${present} | ${rate.padEnd(5)} | ${absences}`);
      });
    }

    // Test if this is a table or view
    console.log('\n🔧 Testing if grade_attendance_timeline_summary is a table or view...');
    
    const { data: insertTest, error: insertError } = await supabase
      .from('grade_attendance_timeline_summary')
      .insert({
        school_id: 'test-id',
        grade_level: 999,
        summary_date: '2024-01-01',
        total_students: 1,
        students_present: 1,
        attendance_rate: 100
      });
      
    console.log('INSERT test:', insertError ? `❌ ${insertError.message}` : '✅ Works (it\'s a table)');

    // Get date range info
    console.log('\n📅 Date range analysis:');
    const { data: dateRange, error: dateError } = await supabase
      .from('grade_attendance_timeline_summary')
      .select('summary_date')
      .order('summary_date', { ascending: true });

    if (!dateError && dateRange && dateRange.length > 0) {
      const dates = dateRange.map(r => r.summary_date);
      const uniqueDates = [...new Set(dates)];
      console.log(`   Date range: ${uniqueDates[0]} to ${uniqueDates[uniqueDates.length - 1]}`);
      console.log(`   Total unique dates: ${uniqueDates.length}`);
      console.log(`   Total records: ${dates.length}`);
      console.log(`   Records per date (avg): ${(dates.length / uniqueDates.length).toFixed(1)}`);
    }

    // Get school/grade breakdown
    console.log('\n🏫 School and grade breakdown:');
    const { data: breakdown, error: breakdownError } = await supabase
      .from('grade_attendance_timeline_summary')
      .select('school_id, grade_level, summary_date')
      .limit(1000);

    if (!breakdownError && breakdown) {
      const schoolGrades = {};
      breakdown.forEach(record => {
        const key = `${record.school_id}_${record.grade_level}`;
        if (!schoolGrades[key]) {
          schoolGrades[key] = 0;
        }
        schoolGrades[key]++;
      });
      
      console.log(`   Unique school/grade combinations: ${Object.keys(schoolGrades).length}`);
      console.log(`   Sample combinations (records count):`);
      Object.entries(schoolGrades).slice(0, 10).forEach(([key, count]) => {
        const [schoolId, grade] = key.split('_');
        console.log(`     School ${schoolId.substring(0, 8)}... Grade ${grade}: ${count} records`);
      });
    }

  } catch (error) {
    console.error('❌ Error examining timeline table:', error);
  }
}

// Run the examination
if (require.main === module) {
  examineTimelineTable().then(() => {
    console.log('\n✅ Timeline table examination complete!');
    process.exit(0);
  }).catch(error => {
    console.error('\n❌ Timeline table examination failed:', error);
    process.exit(1);
  });
}

module.exports = { examineTimelineTable };