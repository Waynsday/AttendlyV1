#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../ap-tool-v1/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugStudentIds() {
  console.log('🔍 Debugging Student ID Issues...\n');
  
  try {
    // Get count with different approaches
    const { count: totalCount } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true });
    
    const { count: withDistrictId } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true })
      .not('district_student_id', 'is', null);
    
    const { count: withAeriesId } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true })
      .not('aeries_student_id', 'is', null);
    
    const { count: nullDistrictId } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true })
      .is('district_student_id', null);
    
    console.log('📊 Count Analysis:');
    console.log(`   Total students: ${totalCount}`);
    console.log(`   With district_student_id: ${withDistrictId}`);
    console.log(`   With aeries_student_id: ${withAeriesId}`);
    console.log(`   NULL district_student_id: ${nullDistrictId}`);
    
    // Get sample of students with and without district_student_id
    console.log('\n📋 Sample students WITH district_student_id:');
    const { data: withIds } = await supabase
      .from('students')
      .select('first_name, last_name, district_student_id, aeries_student_id')
      .not('district_student_id', 'is', null)
      .limit(5);
    
    withIds.forEach((student, index) => {
      console.log(`   ${index + 1}. ${student.first_name} ${student.last_name}`);
      console.log(`      district_student_id: ${student.district_student_id} (${student.district_student_id?.length} digits)`);
      console.log(`      aeries_student_id: ${student.aeries_student_id}`);
    });
    
    console.log('\n📋 Sample students WITHOUT district_student_id:');
    const { data: withoutIds } = await supabase
      .from('students')
      .select('first_name, last_name, district_student_id, aeries_student_id')
      .is('district_student_id', null)
      .limit(5);
    
    if (withoutIds.length > 0) {
      withoutIds.forEach((student, index) => {
        console.log(`   ${index + 1}. ${student.first_name} ${student.last_name}`);
        console.log(`      district_student_id: NULL`);
        console.log(`      aeries_student_id: ${student.aeries_student_id || 'NULL'}`);
      });
    } else {
      console.log('   No students found with NULL district_student_id');
    }
    
    // Check if the issue is with empty strings instead of NULL
    console.log('\n📋 Checking for empty string district_student_id:');
    const { data: emptyStrings } = await supabase
      .from('students')
      .select('first_name, last_name, district_student_id, aeries_student_id')
      .eq('district_student_id', '')
      .limit(5);
    
    if (emptyStrings.length > 0) {
      console.log('   Found students with empty string district_student_id:');
      emptyStrings.forEach((student, index) => {
        console.log(`   ${index + 1}. ${student.first_name} ${student.last_name}`);
        console.log(`      district_student_id: "${student.district_student_id}"`);
        console.log(`      aeries_student_id: ${student.aeries_student_id}`);
      });
    } else {
      console.log('   No students with empty string district_student_id');
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }
}

debugStudentIds();