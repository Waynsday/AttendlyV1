#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../ap-tool-v1/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyStudentSync() {
  console.log('🔍 Verifying Student Sync Results...\n');
  
  try {
    // Get total count
    const { count: totalCount, error: countError } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true });
      
    if (countError) throw countError;
    
    console.log(`📊 Total students in database: ${totalCount}\n`);
    
    // Get all students to analyze
    const { data: allStudents, error: fetchError } = await supabase
      .from('students')
      .select('district_student_id, aeries_student_id, first_name, last_name');
      
    if (fetchError) throw fetchError;
    
    // Analyze the data
    let studentsWithIds = 0;
    let studentsWithoutIds = 0;
    let sevenDigitCount = 0;
    let matchingCount = 0;
    const noIdExamples = [];
    const nonSevenDigitExamples = [];
    
    allStudents.forEach(student => {
      if (student.district_student_id) {
        studentsWithIds++;
        
        if (student.district_student_id.length === 7) {
          sevenDigitCount++;
        } else if (nonSevenDigitExamples.length < 5) {
          nonSevenDigitExamples.push(student);
        }
        
        if (student.district_student_id === student.aeries_student_id) {
          matchingCount++;
        }
      } else {
        studentsWithoutIds++;
        if (noIdExamples.length < 5) {
          noIdExamples.push(student);
        }
      }
    });
    
    // Display results
    console.log('📊 SYNC VERIFICATION RESULTS:');
    console.log('================================');
    console.log(`✅ Students with district_student_id: ${studentsWithIds}`);
    console.log(`❌ Students without district_student_id: ${studentsWithoutIds}`);
    console.log(`✅ Students with 7-digit IDs: ${sevenDigitCount}`);
    console.log(`✅ Students with matching IDs (district = aeries): ${matchingCount}`);
    console.log(`📊 Success rate: ${Math.round(sevenDigitCount/totalCount * 100)}%`);
    
    // Show examples of problematic records
    if (noIdExamples.length > 0) {
      console.log('\n⚠️  Students WITHOUT district_student_id:');
      noIdExamples.forEach((student, index) => {
        console.log(`   ${index + 1}. ${student.first_name} ${student.last_name}`);
        console.log(`      district_student_id: NULL`);
        console.log(`      aeries_student_id: ${student.aeries_student_id || 'NULL'}`);
      });
    }
    
    if (nonSevenDigitExamples.length > 0) {
      console.log('\n⚠️  Students with non-7-digit IDs:');
      nonSevenDigitExamples.forEach((student, index) => {
        console.log(`   ${index + 1}. ${student.first_name} ${student.last_name}`);
        console.log(`      district_student_id: ${student.district_student_id} (${student.district_student_id.length} digits)`);
        console.log(`      aeries_student_id: ${student.aeries_student_id}`);
      });
    }
    
    // Summary
    console.log('\n📊 SUMMARY:');
    if (sevenDigitCount === totalCount) {
      console.log('✅ ALL students have correct 7-digit IDs!');
      console.log('✅ Database is ready for iReady data import.');
    } else {
      console.log(`⚠️  ${totalCount - sevenDigitCount} students need attention.`);
      console.log('   Consider running the sync again or checking Aeries data.');
    }
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
  }
}

verifyStudentSync();