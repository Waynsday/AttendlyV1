#!/usr/bin/env node

/**
 * Debug Student Matching Issues
 * 
 * Check why student matching rate is lower than expected
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../ap-tool-v1/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugMatching() {
  console.log('🔧 DEBUGGING STUDENT MATCHING');
  console.log('='.repeat(50));
  
  try {
    // Check total records vs matched records
    const { count: totalRecords } = await supabase
      .from('iready_diagnostic_results')
      .select('*', { count: 'exact', head: true });
    
    const { count: matchedRecords } = await supabase
      .from('iready_diagnostic_results')
      .select('*', { count: 'exact', head: true })
      .not('student_id', 'is', null);
    
    const { count: unmatchedRecords } = await supabase
      .from('iready_diagnostic_results')
      .select('*', { count: 'exact', head: true })
      .is('student_id', null);
    
    console.log(`📊 Total records: ${totalRecords?.toLocaleString()}`);
    console.log(`✅ Matched records: ${matchedRecords?.toLocaleString()}`);
    console.log(`❌ Unmatched records: ${unmatchedRecords?.toLocaleString()}`);
    console.log(`📈 Match rate: ${Math.round(matchedRecords/totalRecords*100)}%`);
    
    // Get some sample unmatched records
    const { data: unmatchedSamples } = await supabase
      .from('iready_diagnostic_results')
      .select('district_student_id, student_name, academic_year_int, subject')
      .is('student_id', null)
      .limit(10);
    
    console.log('\n🔍 Sample Unmatched Records:');
    unmatchedSamples?.forEach((record, index) => {
      console.log(`   ${index + 1}. ID: ${record.district_student_id}, Name: ${record.student_name}`);
    });
    
    // Check if these students exist in the students table
    if (unmatchedSamples && unmatchedSamples.length > 0) {
      console.log('\n🔍 Checking if these students exist in students table:');
      
      for (const sample of unmatchedSamples.slice(0, 5)) {
        const { data: studentExists } = await supabase
          .from('students')
          .select('id, district_student_id, first_name, last_name')
          .eq('district_student_id', sample.district_student_id);
        
        if (studentExists && studentExists.length > 0) {
          console.log(`   ✅ ${sample.district_student_id} exists: ${studentExists[0].first_name} ${studentExists[0].last_name}`);
        } else {
          console.log(`   ❌ ${sample.district_student_id} NOT found in students table`);
        }
      }
    }
    
    // Check for any formatting issues in district_student_id
    const { data: ireadyIds } = await supabase
      .from('iready_diagnostic_results')
      .select('district_student_id')
      .limit(10);
    
    const { data: studentIds } = await supabase
      .from('students')
      .select('district_student_id')
      .limit(10);
    
    console.log('\n🔍 Sample ID formats:');
    console.log('   iReady table IDs:', ireadyIds?.map(r => `"${r.district_student_id}"`).slice(0, 5));
    console.log('   Students table IDs:', studentIds?.map(r => `"${r.district_student_id}"`).slice(0, 5));
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
    throw error;
  }
}

async function main() {
  try {
    await debugMatching();
  } catch (error) {
    console.error('💥 Debug failed:', error);
    process.exit(1);
  }
}

main();