#!/usr/bin/env node

/**
 * Check if grade_attendance_summaries is a table or view
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkTableType() {
  console.log('🔍 Checking grade_attendance_summaries table type\n');
  
  try {
    // Try to get table/view information from information_schema
    console.log('📋 Checking information_schema...');
    
    // Check if it's a table
    const { data: tableInfo, error: tableError } = await supabase
      .rpc('sql', { 
        query: `
          SELECT table_name, table_type 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'grade_attendance_summaries'
        `
      });

    if (!tableError && tableInfo) {
      console.log('Table/View info:', tableInfo);
    } else {
      console.log('Could not get table info via RPC');
    }

    // Try alternative approach - check what happens when we try operations
    console.log('\n🔧 Testing operations...');
    
    // Test SELECT (should work for both tables and views)
    const { data: selectTest, error: selectError } = await supabase
      .from('grade_attendance_summaries')
      .select('school_id')
      .limit(1);
      
    console.log('SELECT test:', selectError ? `❌ ${selectError.message}` : '✅ Works');
    
    // Test INSERT (should fail for views)
    const { data: insertTest, error: insertError } = await supabase
      .from('grade_attendance_summaries')
      .insert({
        school_id: 'test',
        grade_level: 1,
        school_name: 'Test',
        total_students: 1,
        attendance_rate: 100
      });
      
    console.log('INSERT test:', insertError ? `❌ ${insertError.message}` : '✅ Works');
    
    // Test UPDATE (should fail for views)
    const { data: updateTest, error: updateError } = await supabase
      .from('grade_attendance_summaries')
      .update({ attendance_rate: 99 })
      .eq('school_id', 'nonexistent');
      
    console.log('UPDATE test:', updateError ? `❌ ${updateError.message}` : '✅ Works');
    
    // Test DELETE (should fail for views)
    const { data: deleteTest, error: deleteError } = await supabase
      .from('grade_attendance_summaries')
      .delete()
      .eq('school_id', 'nonexistent');
      
    console.log('DELETE test:', deleteError ? `❌ ${deleteError.message}` : '✅ Works');

    // Check for underlying tables that might contain the actual data
    console.log('\n🔍 Looking for related tables...');
    const possibleTables = [
      'grade_summaries',
      'attendance_summaries',
      'grade_attendance_summary',
      'school_grade_summaries',
      'daily_grade_summaries'
    ];
    
    for (const tableName of possibleTables) {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);
        
      if (!error) {
        console.log(`✅ Found table: ${tableName}`);
        if (data && data.length > 0) {
          console.log(`   Sample columns: ${Object.keys(data[0]).join(', ')}`);
        }
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the check
if (require.main === module) {
  checkTableType().then(() => {
    console.log('\n✅ Check complete!');
    process.exit(0);
  }).catch(error => {
    console.error('\n❌ Check failed:', error);
    process.exit(1);
  });
}

module.exports = { checkTableType };