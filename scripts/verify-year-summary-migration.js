#!/usr/bin/env node

/**
 * Verify Year Summary Migration
 * 
 * This script verifies that the iready_year_summary table has been
 * successfully migrated to use academic_year_int instead of academic_year enum.
 */

const { createClient } = require('@supabase/supabase-js');

// Try multiple possible .env locations
const dotenv = require('dotenv');
const path = require('path');

// Try to load environment variables from various locations
const envPaths = [
  '../ap-tool-v1/.env.local',
  '../.env.local', 
  '.env.local',
  '.env'
];

let envLoaded = false;
for (const envPath of envPaths) {
  try {
    const result = dotenv.config({ path: envPath });
    if (!result.error) {
      console.log(`✅ Environment loaded from: ${envPath}`);
      envLoaded = true;
      break;
    }
  } catch (error) {
    // Continue to next path
  }
}

if (!envLoaded) {
  console.log('⚠️  No .env file found. Please ensure environment variables are set.');
  console.log('   Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log('❌ Missing required environment variables:');
  console.log('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
  console.log('   SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? '✅' : '❌');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyYearSummaryMigration() {
  console.log('🔍 VERIFYING YEAR SUMMARY MIGRATION');
  console.log('='.repeat(40));

  try {
    // 1. Check if we can query the table at all
    console.log('\n📋 Step 1: Testing table access...');
    const { data: testData, error: testError } = await supabase
      .from('iready_year_summary')
      .select('*')
      .limit(1);

    if (testError) {
      console.log(`   ❌ Cannot access table: ${testError.message}`);
      return;
    }
    console.log('   ✅ Table is accessible');

    // 2. Check table structure
    console.log('\n📊 Step 2: Analyzing table structure...');
    if (testData && testData.length > 0) {
      const columns = Object.keys(testData[0]);
      console.log(`   📝 Available columns (${columns.length}):`, columns.join(', '));
      
      // Check for the key columns we care about
      const hasAcademicYearInt = columns.includes('academic_year_int');
      const hasOldAcademicYear = columns.includes('academic_year');
      
      console.log(`   🔍 academic_year_int column: ${hasAcademicYearInt ? '✅ Present' : '❌ Missing'}`);
      console.log(`   🔍 academic_year column: ${hasOldAcademicYear ? '⚠️  Still present' : '✅ Removed'}`);
      
      if (hasAcademicYearInt) {
        console.log('   ✅ Migration appears successful - new column exists');
      } else {
        console.log('   ❌ Migration incomplete - academic_year_int column missing');
        return;
      }
    } else {
      console.log('   📋 Table is empty - checking structure differently...');
      
      // Try to insert a test record to check column structure
      const testRecord = {
        academic_year_int: 2024,
        school_year: '2024-2025',
        subject: 'TEST',
        grade_level: 'K',
        total_students: 0,
        total_assessments: 0
      };
      
      const { error: insertError } = await supabase
        .from('iready_year_summary')
        .insert([testRecord]);
      
      if (insertError) {
        if (insertError.message.includes('academic_year_int')) {
          if (insertError.message.includes('does not exist')) {
            console.log('   ❌ academic_year_int column does not exist');
            return;
          } else {
            console.log('   ✅ academic_year_int column exists (validation error expected)');
          }
        } else {
          console.log(`   ⚠️  Insert test failed: ${insertError.message}`);
        }
      } else {
        console.log('   ✅ Test record inserted successfully');
        // Clean up test record
        await supabase
          .from('iready_year_summary')
          .delete()
          .eq('subject', 'TEST');
      }
    }

    // 3. Check current data
    console.log('\n📊 Step 3: Checking current data...');
    const { data: summaryData, count } = await supabase
      .from('iready_year_summary')
      .select('academic_year_int, school_year, subject, grade_level, total_students, total_assessments', { count: 'exact' })
      .order('academic_year_int', { ascending: false });

    console.log(`   📊 Total summary records: ${count || 0}`);
    
    if (summaryData && summaryData.length > 0) {
      console.log('   📈 Sample records:');
      summaryData.slice(0, 5).forEach((record, index) => {
        console.log(`   ${index + 1}. Year: ${record.academic_year_int} | School: ${record.school_year} | ${record.subject} Grade ${record.grade_level}`);
      });
      
      // Check for data quality
      const yearsFound = [...new Set(summaryData.map(r => r.academic_year_int))].sort((a, b) => b - a);
      const subjectsFound = [...new Set(summaryData.map(r => r.subject))];
      
      console.log(`   📅 Academic years: ${yearsFound.join(', ')}`);
      console.log(`   📚 Subjects: ${subjectsFound.join(', ')}`);
    } else {
      console.log('   📋 No summary data found');
    }

    // 4. Check related diagnostic data
    console.log('\n🔗 Step 4: Checking related diagnostic data...');
    const { count: diagnosticCount } = await supabase
      .from('iready_diagnostic_results')
      .select('*', { count: 'exact' })
      .not('academic_year_int', 'is', null);

    console.log(`   📊 Diagnostic records with academic_year_int: ${diagnosticCount || 0}`);

    // 5. Summary
    console.log('\n' + '='.repeat(40));
    console.log('📋 MIGRATION VERIFICATION SUMMARY');
    console.log('='.repeat(40));
    
    if (count > 0) {
      console.log('✅ Year summary table successfully migrated');
      console.log(`✅ ${count} summary records using academic_year_int`);
      console.log('✅ Ready for year-based analytics');
    } else {
      console.log('⚠️  Migration structure complete but no data populated');
      console.log('💡 Consider running the summary regeneration script');
    }

  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    throw error;
  }
}

async function main() {
  try {
    await verifyYearSummaryMigration();
  } catch (error) {
    console.error('💥 Verification process failed:', error);
    process.exit(1);
  }
}

main();