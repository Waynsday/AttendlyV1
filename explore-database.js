#!/usr/bin/env node

/**
 * Database exploration script for reviewing grade_attendance_summary
 * and attendance_records tables in Supabase
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function exploreTables() {
  console.log('🔍 Exploring Supabase Database Tables\n');
  
  try {
    // 1. First, let's see what tables exist
    console.log('📋 Available Tables:');
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .order('table_name');
      
    if (tablesError) {
      console.error('Error fetching tables:', tablesError);
      // Try alternative approach
      console.log('\n🔄 Trying alternative approach to list tables...\n');
      await listKnownTables();
      return;
    }

    tables.forEach(table => {
      console.log(`  - ${table.table_name}`);
    });

    // 2. Check if grade_attendance_summaries exists (table or view)
    console.log('\n📊 Checking for grade_attendance_summaries...');
    await checkGradeAttendanceSummaries();

    // 3. Examine attendance_records structure
    console.log('\n📋 Attendance Records Table Structure:');
    await examineAttendanceRecords();

    // 4. Sample data from attendance_records
    console.log('\n📊 Sample Attendance Records Data:');
    await sampleAttendanceRecords();

    // 5. Check for related timeline tables
    console.log('\n🕒 Timeline Summary Tables:');
    await examineTimelineTables();

  } catch (error) {
    console.error('Error exploring database:', error);
  }
}

async function listKnownTables() {
  const knownTables = [
    'schools',
    'students', 
    'teachers',
    'attendance_records',
    'grade_attendance_summaries',
    'grade_attendance_timeline_summary',
    'district_attendance_timeline_summary',
    'truancy_letters',
    'sarb_referrals',
    'recovery_sessions',
    'iready_scores'
  ];

  for (const tableName of knownTables) {
    try {
      // Try to get count without RLS restrictions
      const { count, error } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });
        
      if (!error) {
        console.log(`  ✅ ${tableName} (${count || 0} records)`);
        
        // If count > 0, try to get sample data
        if (count > 0) {
          const { data: sampleData, error: sampleError } = await supabase
            .from(tableName)
            .select('*')
            .limit(1);
            
          if (!sampleError && sampleData && sampleData.length > 0) {
            console.log(`     Sample columns: ${Object.keys(sampleData[0]).slice(0, 5).join(', ')}...`);
          }
        }
      } else {
        console.log(`  ❌ ${tableName} - ${error.message}`);
      }
    } catch (err) {
      console.log(`  ❌ ${tableName} - Error: ${err.message}`);
    }
  }
}

async function checkGradeAttendanceSummaries() {
  try {
    // Try to query the table/view
    const { data, error, count } = await supabase
      .from('grade_attendance_summaries')
      .select('*', { count: 'exact' })
      .limit(5);

    if (error) {
      console.log(`  ❌ grade_attendance_summaries does not exist or is not accessible`);
      console.log(`     Error: ${error.message}`);
    } else {
      console.log(`  ✅ grade_attendance_summaries found with ${count} records`);
      if (data && data.length > 0) {
        console.log('  📋 Sample record structure:');
        console.log('     Columns:', Object.keys(data[0]).join(', '));
        console.log('  📊 Sample data:');
        data.slice(0, 2).forEach((record, i) => {
          console.log(`     Record ${i + 1}:`, JSON.stringify(record, null, 6));
        });
      } else if (count === 0) {
        console.log('  ⚠️  Table exists but has no records');
        
        // Get table structure by describing it
        console.log('\n  📋 Getting table structure...');
        await getTableStructure('grade_attendance_summaries');
      }
    }
  } catch (err) {
    console.log(`  ❌ Error checking grade_attendance_summaries: ${err.message}`);
  }
}

async function getTableStructure(tableName) {
  try {
    // Try to get column information from information_schema
    const { data, error } = await supabase
      .rpc('get_table_columns', { table_name: tableName });
      
    if (error) {
      console.log(`     Could not get table structure via RPC: ${error.message}`);
      
      // Alternative: Try to insert a dummy record to see what columns are expected
      console.log('     Attempting to determine structure through schema inference...');
      
      const { data: insertData, error: insertError } = await supabase
        .from(tableName)
        .insert({})
        .select();
        
      if (insertError) {
        console.log(`     Insert error reveals expected columns: ${insertError.message}`);
      }
    } else {
      console.log('     Table columns:', data);
    }
  } catch (err) {
    console.log(`     Error getting table structure: ${err.message}`);
  }
}

async function examineAttendanceRecords() {
  try {
    // Get table structure by examining a few records
    const { data, error, count } = await supabase
      .from('attendance_records')
      .select('*', { count: 'exact' })
      .limit(3);

    if (error) {
      console.log(`  ❌ attendance_records: ${error.message}`);
      return;
    }

    console.log(`  ✅ attendance_records table found with ${count} total records`);
    
    if (data && data.length > 0) {
      console.log('  📋 Column Structure:');
      const columns = Object.keys(data[0]);
      columns.forEach(col => {
        const sampleValue = data[0][col];
        const valueType = typeof sampleValue;
        console.log(`     ${col}: ${valueType} ${sampleValue !== null ? `(e.g., ${sampleValue})` : '(null)'}`);
      });
    }

    // Check for grade information
    console.log('\n  📊 Grade Distribution:');
    const { data: grades, error: gradeError } = await supabase
      .from('attendance_records')
      .select('grade_level')
      .not('grade_level', 'is', null);

    if (!gradeError && grades) {
      const gradeSet = new Set(grades.map(g => g.grade_level));
      console.log(`     Grades found: ${Array.from(gradeSet).sort().join(', ')}`);
    }

    // Check date range
    console.log('\n  📅 Date Range:');
    const { data: dateRange, error: dateError } = await supabase
      .from('attendance_records')
      .select('attendance_date')
      .order('attendance_date', { ascending: true })
      .limit(1);

    const { data: dateRangeEnd, error: dateEndError } = await supabase
      .from('attendance_records')
      .select('attendance_date')
      .order('attendance_date', { ascending: false })
      .limit(1);

    if (!dateError && !dateEndError && dateRange && dateRangeEnd) {
      console.log(`     From: ${dateRange[0]?.attendance_date} To: ${dateRangeEnd[0]?.attendance_date}`);
    }

  } catch (err) {
    console.log(`  ❌ Error examining attendance_records: ${err.message}`);
  }
}

async function sampleAttendanceRecords() {
  try {
    const { data, error } = await supabase
      .from('attendance_records')
      .select('*')
      .limit(3);

    if (error) {
      console.log(`  ❌ Error sampling data: ${error.message}`);
      return;
    }

    if (data && data.length > 0) {
      data.forEach((record, i) => {
        console.log(`  📋 Sample Record ${i + 1}:`);
        Object.entries(record).forEach(([key, value]) => {
          console.log(`     ${key}: ${value}`);
        });
        console.log('');
      });
    }
  } catch (err) {
    console.log(`  ❌ Error sampling attendance records: ${err.message}`);
  }
}

async function examineTimelineTables() {
  const timelineTables = [
    'grade_attendance_timeline_summary',
    'district_attendance_timeline_summary'
  ];

  for (const tableName of timelineTables) {
    try {
      const { data, error, count } = await supabase
        .from(tableName)
        .select('*', { count: 'exact' })
        .limit(2);

      if (error) {
        console.log(`  ❌ ${tableName}: ${error.message}`);
      } else {
        console.log(`  ✅ ${tableName}: ${count} records`);
        if (data && data.length > 0) {
          console.log(`     Columns: ${Object.keys(data[0]).join(', ')}`);
        }
      }
    } catch (err) {
      console.log(`  ❌ ${tableName}: ${err.message}`);
    }
  }
}

// Run the exploration
if (require.main === module) {
  exploreTables().then(() => {
    console.log('\n✅ Database exploration complete!');
    process.exit(0);
  }).catch(error => {
    console.error('\n❌ Database exploration failed:', error);
    process.exit(1);
  });
}

module.exports = { exploreTables };