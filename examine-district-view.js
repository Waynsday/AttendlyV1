#!/usr/bin/env node

/**
 * Examine district_attendance_summary view structure and data
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function examineDistrictView() {
  console.log('🔍 Examining district_attendance_summary view\n');
  
  try {
    // Get sample data from district view
    console.log('📊 Current district_attendance_summary data:');
    const { data, error, count } = await supabase
      .from('district_attendance_summary')
      .select('*', { count: 'exact' })
      .limit(10);

    if (error) {
      console.log(`❌ Error: ${error.message}`);
      return;
    }

    console.log(`✅ Found ${count} records in district_attendance_summary\n`);
    
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
      console.log('ID | Grade | Students | Attendance Rate | Risk Level');
      console.log('---|-------|----------|-----------------|------------');
      
      data.forEach(record => {
        const id = String(record.id || 'N/A').substring(0, 8);
        const grade = String(record.grade_level || 'N/A').padEnd(5);
        const students = String(record.total_students || 0).padEnd(8);
        const rate = record.attendance_rate ? `${record.attendance_rate}%` : 'N/A';
        const risk = String(record.risk_level || 'N/A').padEnd(10);
        console.log(`${id} | ${grade} | ${students} | ${rate.padEnd(15)} | ${risk}`);
      });
      
      // Show all data if it's a small dataset
      if (count <= 20) {
        console.log('\n📋 All Records:');
        data.forEach((record, i) => {
          console.log(`\nRecord ${i + 1}:`);
          Object.entries(record).forEach(([key, value]) => {
            console.log(`  ${key}: ${value}`);
          });
        });
      }
    }

    // Test if this is also a view
    console.log('\n🔧 Testing if district_attendance_summary is a view...');
    
    const { data: insertTest, error: insertError } = await supabase
      .from('district_attendance_summary')
      .insert({
        grade_level: 999,
        total_students: 1,
        attendance_rate: 100
      });
      
    console.log('INSERT test:', insertError ? `❌ ${insertError.message}` : '✅ Works (it\'s a table)');

  } catch (error) {
    console.error('❌ Error examining district view:', error);
  }
}

// Run the examination
if (require.main === module) {
  examineDistrictView().then(() => {
    console.log('\n✅ District view examination complete!');
    process.exit(0);
  }).catch(error => {
    console.error('\n❌ District view examination failed:', error);
    process.exit(1);
  });
}

module.exports = { examineDistrictView };