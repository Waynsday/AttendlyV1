#!/usr/bin/env node

/**
 * Verify iReady Data Upload Progress
 * 
 * This script checks the current status of the iReady data upload
 * and provides detailed statistics.
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../ap-tool-v1/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyUpload() {
  console.log('🔍 IREADY DATA UPLOAD VERIFICATION');
  console.log('='.repeat(50));

  try {
    // 1. Check main diagnostic results table
    console.log('\n📊 DIAGNOSTIC RESULTS:');
    const { data: results, error: resultsError, count: totalCount } = await supabase
      .from('iready_diagnostic_results')
      .select('*', { count: 'exact', head: true });

    if (resultsError) {
      console.log('❌ Error accessing diagnostic results:', resultsError.message);
      return;
    }

    console.log(`Total Records: ${totalCount || 0}`);

    // Get counts by year and subject
    const { data: allRecords } = await supabase
      .from('iready_diagnostic_results')
      .select('academic_year_int, subject');

    const yearSubjectCounts = [];
    if (allRecords) {
      const counts = {};
      allRecords.forEach(row => {
        const key = `${row.academic_year_int}_${row.subject}`;
        counts[key] = (counts[key] || 0) + 1;
      });
      
      Object.entries(counts).forEach(([key, count]) => {
        const [academic_year_int, subject] = key.split('_');
        yearSubjectCounts.push({ academic_year_int, subject, count });
      });
    }

    console.log('\nBy Academic Year and Subject:');
    const yearSubjectMap = {};
    (yearSubjectCounts || []).forEach(row => {
      if (!yearSubjectMap[row.academic_year_int]) {
        yearSubjectMap[row.academic_year_int] = {};
      }
      yearSubjectMap[row.academic_year_int][row.subject] = row.count;
    });

    Object.entries(yearSubjectMap).forEach(([year, subjects]) => {
      const totalForYear = Object.values(subjects).reduce((a, b) => a + b, 0);
      console.log(`  📅 ${year}: ${totalForYear} total`);
      Object.entries(subjects).forEach(([subject, count]) => {
        console.log(`    📚 ${subject}: ${count} records`);
      });
    });

    // 2. Check ETL operations
    console.log('\n⚙️  ETL OPERATIONS:');
    const { data: etlOps } = await supabase
      .from('iready_etl_operations')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (etlOps && etlOps.length > 0) {
      etlOps.forEach(op => {
        const status = op.operation_status || 'UNKNOWN';
        const statusIcon = status === 'COMPLETED' ? '✅' : status === 'STARTED' ? '⚙️' : '❌';
        console.log(`  ${statusIcon} ${op.operation_type} - ${status}`);
        console.log(`     Started: ${op.start_time}`);
        if (op.end_time) console.log(`     Ended: ${op.end_time}`);
        if (op.total_records_processed) console.log(`     Records: ${op.total_records_processed}`);
        if (op.processing_time_seconds) console.log(`     Duration: ${op.processing_time_seconds}s`);
      });
    } else {
      console.log('  No ETL operations found');
    }

    // 3. Check student/teacher ID resolution stats
    console.log('\n🔗 ID RESOLUTION:');
    const { data: studentData } = await supabase
      .from('iready_diagnostic_results')
      .select('student_id');

    const { data: teacherData } = await supabase
      .from('iready_diagnostic_results')
      .select('teacher_id');

    let studentIdStats = { withId: 0, withoutId: 0, total: 0 };
    let teacherIdStats = { withId: 0, withoutId: 0, total: 0 };

    if (studentData) {
      studentIdStats = {
        withId: studentData.filter(row => row.student_id !== null).length,
        withoutId: studentData.filter(row => row.student_id === null).length,
        total: studentData.length
      };
    }

    if (teacherData) {
      teacherIdStats = {
        withId: teacherData.filter(row => row.teacher_id !== null).length,
        withoutId: teacherData.filter(row => row.teacher_id === null).length,
        total: teacherData.length
      };
    }

    if (studentIdStats.total > 0) {
      const studentMatchRate = Math.round((studentIdStats.withId / studentIdStats.total) * 100);
      console.log(`  👥 Students: ${studentIdStats.withId}/${studentIdStats.total} matched (${studentMatchRate}%)`);
    }

    if (teacherIdStats.total > 0) {
      const teacherMatchRate = Math.round((teacherIdStats.withId / teacherIdStats.total) * 100);
      console.log(`  👨‍🏫 Teachers: ${teacherIdStats.withId}/${teacherIdStats.total} matched (${teacherMatchRate}%)`);
    }

    // 4. Sample records for validation
    console.log('\n📋 SAMPLE RECORDS:');
    const { data: sampleRecords } = await supabase
      .from('iready_diagnostic_results')
      .select('district_student_id, student_name, subject, overall_scale_score, diagnostic_date, academic_year_int')
      .limit(5);

    if (sampleRecords && sampleRecords.length > 0) {
      sampleRecords.forEach(record => {
        console.log(`  • ${record.student_name} (${record.district_student_id})`);
        console.log(`    ${record.subject} Score: ${record.overall_scale_score} | ${record.academic_year_int} | ${record.diagnostic_date}`);
      });
    }

    // 5. Data quality summary  
    console.log('\n🔍 DATA QUALITY:');
    const { data: qualityStats } = await supabase
      .from('iready_diagnostic_results')
      .select('data_quality_score, academic_year_int')
      .not('academic_year_int', 'is', null)
      .then(({ data }) => {
        if (!data || data.length === 0) return null;
        const scores = data.map(row => row.data_quality_score || 0);
        const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        const highQuality = scores.filter(s => s >= 0.9).length;
        const mediumQuality = scores.filter(s => s >= 0.7 && s < 0.9).length;
        const lowQuality = scores.filter(s => s < 0.7).length;
        return { avgScore, highQuality, mediumQuality, lowQuality, total: scores.length };
      });

    if (qualityStats) {
      console.log(`  📈 Average Quality Score: ${qualityStats.avgScore.toFixed(2)}`);
      console.log(`  ✅ High Quality (≥0.9): ${qualityStats.highQuality}`);
      console.log(`  ⚠️  Medium Quality (0.7-0.9): ${qualityStats.mediumQuality}`);
      console.log(`  ❌ Low Quality (<0.7): ${qualityStats.lowQuality}`);
    }

    // 6. Expected vs Actual counts
    console.log('\n📊 EXPECTED VS ACTUAL:');
    console.log('  Expected (from CSV analysis): ~85,397 records');
    const totalActual = Object.values(yearSubjectMap).reduce((sum, subjects) => 
      sum + Object.values(subjects).reduce((a, b) => a + b, 0), 0);
    console.log(`  Actual (in database): ${totalActual} records`);
    
    if (totalActual > 0) {
      const completionRate = Math.round((totalActual / 85397) * 100);
      console.log(`  🎯 Completion Rate: ${completionRate}%`);

      if (completionRate >= 95) {
        console.log('\n🎉 UPLOAD COMPLETE! All data successfully imported.');
      } else if (completionRate >= 80) {
        console.log('\n✅ UPLOAD MOSTLY COMPLETE! Minor data remaining.');
      } else if (completionRate >= 50) {
        console.log('\n⚙️  UPLOAD IN PROGRESS! Significant progress made.');
      } else {
        console.log('\n🚧 UPLOAD STARTING! Early stage of import process.');
      }
    }

  } catch (error) {
    console.error('❌ Verification failed:', error.message);
  }
}

verifyUpload();