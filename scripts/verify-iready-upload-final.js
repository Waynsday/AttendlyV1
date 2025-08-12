#!/usr/bin/env node

/**
 * Verify iReady Upload Results
 * 
 * Check the uploaded data and provide summary statistics
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../ap-tool-v1/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyUpload() {
  console.log('🔍 VERIFYING IREADY UPLOAD RESULTS');
  console.log('='.repeat(50));
  
  try {
    // Get overall count
    const { count: totalCount, error: countError } = await supabase
      .from('iready_diagnostic_results')
      .select('*', { count: 'exact', head: true });
    
    if (countError) throw countError;
    
    console.log(`📊 Total records uploaded: ${totalCount?.toLocaleString()}`);
    
    // Get breakdown by year and subject
    const { data: breakdown, error: breakdownError } = await supabase
      .from('iready_diagnostic_results')
      .select('academic_year_int, school_year, subject, student_id')
      .not('student_id', 'is', null); // Only matched students
    
    if (breakdownError) throw breakdownError;
    
    // Analyze the data
    const summary = {};
    let matchedStudents = 0;
    
    breakdown.forEach(record => {
      const key = `${record.school_year}-${record.subject}`;
      if (!summary[key]) {
        summary[key] = { count: 0, students: new Set() };
      }
      summary[key].count++;
      summary[key].students.add(record.student_id);
      matchedStudents++;
    });
    
    console.log(`\n👥 Records with matched students: ${matchedStudents.toLocaleString()}`);
    console.log(`🔗 Student matching rate: ${Math.round(matchedStudents/totalCount*100)}%`);
    
    console.log('\n📚 Breakdown by Year and Subject:');
    Object.entries(summary).forEach(([key, data]) => {
      console.log(`   ${key}: ${data.count.toLocaleString()} records, ${data.students.size} unique students`);
    });
    
    // Get sample records to verify data quality
    const { data: sampleRecords, error: sampleError } = await supabase
      .from('iready_diagnostic_results')
      .select(`
        district_student_id,
        student_name,
        academic_year_int,
        school_year,
        subject,
        grade_level,
        overall_scale_score,
        overall_placement,
        diagnostic_date,
        student_id
      `)
      .limit(5);
    
    if (sampleError) throw sampleError;
    
    console.log('\n🔍 Sample Records:');
    sampleRecords.forEach((record, index) => {
      console.log(`\n   Record ${index + 1}:`);
      console.log(`     Student: ${record.student_name} (ID: ${record.district_student_id})`);
      console.log(`     Matched: ${record.student_id ? '✅ Yes' : '❌ No'}`);
      console.log(`     Year: ${record.school_year} (${record.academic_year_int})`);
      console.log(`     Subject: ${record.subject}, Grade: ${record.grade_level}`);
      console.log(`     Score: ${record.overall_scale_score}, Placement: ${record.overall_placement}`);
      console.log(`     Date: ${record.diagnostic_date}`);
    });
    
    // Check for any data quality issues
    const { data: qualityCheck, error: qualityError } = await supabase
      .from('iready_diagnostic_results')
      .select('district_student_id, student_name, overall_scale_score, grade_level')
      .or('overall_scale_score.lt.100,overall_scale_score.gt.800');
    
    if (qualityError) throw qualityError;
    
    if (qualityCheck && qualityCheck.length > 0) {
      console.log(`\n⚠️  Found ${qualityCheck.length} records with unusual scale scores (< 100 or > 800)`);
    } else {
      console.log('\n✅ All scale scores appear to be within expected range (100-800)');
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('🎉 VERIFICATION COMPLETED');
    console.log('='.repeat(50));
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    throw error;
  }
}

async function main() {
  try {
    await verifyUpload();
  } catch (error) {
    console.error('💥 Verification failed:', error);
    process.exit(1);
  }
}

main();