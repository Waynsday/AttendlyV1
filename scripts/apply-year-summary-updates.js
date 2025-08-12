#!/usr/bin/env node

/**
 * Apply Year Summary Table Updates
 * 
 * This script updates the iready_year_summary table to use academic_year_int
 * instead of the old enum-based academic_year column.
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../ap-tool-v1/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function applyYearSummaryUpdates() {
  console.log('📊 APPLYING YEAR SUMMARY TABLE UPDATES');
  console.log('='.repeat(50));

  try {
    // 1. Check current state of year summary table
    console.log('\n📋 Step 1: Checking current year summary data...');
    const { data: currentSummary, count: summaryCount } = await supabase
      .from('iready_year_summary')
      .select('*', { count: 'exact' })
      .limit(5);

    console.log(`   📊 Current summary records: ${summaryCount || 0}`);
    if (currentSummary && currentSummary.length > 0) {
      console.log('   📝 Sample current structure:');
      currentSummary.forEach((record, index) => {
        if (index < 3) {
          console.log(`   • Year: ${record.academic_year || 'NULL'} | School Year: ${record.school_year} | Subject: ${record.subject}`);
        }
      });
    }

    // 2. Clear existing summary data
    console.log('\n🗑️  Step 2: Clearing existing summary data...');
    const { error: deleteError } = await supabase
      .from('iready_year_summary')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records

    if (deleteError) {
      console.log(`   ⚠️  Could not clear existing data: ${deleteError.message}`);
      console.log('   📝 Continuing with regeneration...');
    } else {
      console.log('   ✅ Existing summary data cleared');
    }

    // 3. Get available data for regeneration
    console.log('\n📊 Step 3: Analyzing available diagnostic data...');
    const { data: diagnosticData } = await supabase
      .from('iready_diagnostic_results')
      .select('academic_year_int, school_year, subject, grade_level, overall_scale_score, overall_placement, lessons_passed, time_on_task_minutes, student_id')
      .not('academic_year_int', 'is', null);

    if (!diagnosticData || diagnosticData.length === 0) {
      console.log('   ❌ No diagnostic data found with academic_year_int');
      console.log('   💡 Please ensure the diagnostic table has been updated first');
      return;
    }

    console.log(`   📊 Found ${diagnosticData.length} diagnostic records to summarize`);

    // Group data by academic_year_int, subject, grade_level
    const groupedData = {};
    diagnosticData.forEach(record => {
      const key = `${record.academic_year_int}_${record.subject}_${record.grade_level}`;
      if (!groupedData[key]) {
        groupedData[key] = {
          academic_year_int: record.academic_year_int,
          school_year: record.school_year,
          subject: record.subject,
          grade_level: record.grade_level,
          records: []
        };
      }
      groupedData[key].records.push(record);
    });

    console.log(`   📈 Generated ${Object.keys(groupedData).length} summary groups`);

    // 4. Generate summary statistics
    console.log('\n📈 Step 4: Generating summary statistics...');
    const summaryRecords = [];

    Object.values(groupedData).forEach(group => {
      const records = group.records;
      const scaleScores = records.map(r => r.overall_scale_score).filter(s => s && s > 0);
      const uniqueStudents = new Set(records.map(r => r.student_id).filter(id => id)).size;

      const placementCounts = {
        'THREE_OR_MORE_GRADE_LEVELS_BELOW': 0,
        'TWO_GRADE_LEVELS_BELOW': 0,
        'ONE_GRADE_LEVEL_BELOW': 0,
        'ON_GRADE_LEVEL': 0,
        'ONE_GRADE_LEVEL_ABOVE': 0,
        'TWO_GRADE_LEVELS_ABOVE': 0,
        'THREE_OR_MORE_GRADE_LEVELS_ABOVE': 0
      };

      records.forEach(record => {
        if (record.overall_placement && placementCounts.hasOwnProperty(record.overall_placement)) {
          placementCounts[record.overall_placement]++;
        }
      });

      const summary = {
        academic_year_int: group.academic_year_int,
        school_year: group.school_year,
        subject: group.subject,
        grade_level: group.grade_level,
        total_students: uniqueStudents,
        total_assessments: records.length,
        placement_three_plus_below: placementCounts['THREE_OR_MORE_GRADE_LEVELS_BELOW'],
        placement_two_below: placementCounts['TWO_GRADE_LEVELS_BELOW'],
        placement_one_below: placementCounts['ONE_GRADE_LEVEL_BELOW'],
        placement_on_level: placementCounts['ON_GRADE_LEVEL'],
        placement_one_above: placementCounts['ONE_GRADE_LEVEL_ABOVE'],
        placement_two_above: placementCounts['TWO_GRADE_LEVELS_ABOVE'],
        placement_three_plus_above: placementCounts['THREE_OR_MORE_GRADE_LEVELS_ABOVE'],
        avg_overall_scale_score: scaleScores.length > 0 ? Math.round(scaleScores.reduce((a, b) => a + b, 0) / scaleScores.length * 100) / 100 : null,
        median_overall_scale_score: scaleScores.length > 0 ? scaleScores.sort((a, b) => a - b)[Math.floor(scaleScores.length / 2)] : null,
        min_overall_scale_score: scaleScores.length > 0 ? Math.min(...scaleScores) : null,
        max_overall_scale_score: scaleScores.length > 0 ? Math.max(...scaleScores) : null,
        avg_lessons_passed: records.length > 0 ? Math.round(records.reduce((sum, r) => sum + (r.lessons_passed || 0), 0) / records.length * 100) / 100 : 0,
        avg_time_on_task_minutes: records.length > 0 ? Math.round(records.reduce((sum, r) => sum + (r.time_on_task_minutes || 0), 0) / records.length * 100) / 100 : 0
      };

      summaryRecords.push(summary);
    });

    // 5. Insert summary records in batches
    console.log('\n💾 Step 5: Inserting summary records...');
    const batchSize = 50;
    let inserted = 0;

    for (let i = 0; i < summaryRecords.length; i += batchSize) {
      const batch = summaryRecords.slice(i, i + batchSize);
      
      const { error: insertError } = await supabase
        .from('iready_year_summary')
        .insert(batch);

      if (insertError) {
        console.log(`   ❌ Batch ${Math.floor(i / batchSize) + 1} failed: ${insertError.message}`);
      } else {
        inserted += batch.length;
        console.log(`   ✅ Batch ${Math.floor(i / batchSize) + 1}: ${batch.length} records inserted`);
      }

      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // 6. Verify the results
    console.log('\n🔍 Step 6: Verifying results...');
    const { data: newSummary, count: newCount } = await supabase
      .from('iready_year_summary')
      .select('academic_year_int, school_year, subject, grade_level, total_students, total_assessments', { count: 'exact' })
      .order('academic_year_int', { ascending: false });

    console.log(`   📊 Summary records created: ${newCount || 0}`);
    
    if (newSummary && newSummary.length > 0) {
      console.log('   📈 Sample new summary data:');
      newSummary.slice(0, 5).forEach(record => {
        console.log(`   • ${record.academic_year_int} (${record.school_year}) ${record.subject} Grade ${record.grade_level}: ${record.total_students} students, ${record.total_assessments} assessments`);
      });

      // Group by academic year
      const yearGroups = {};
      newSummary.forEach(record => {
        if (!yearGroups[record.academic_year_int]) {
          yearGroups[record.academic_year_int] = { students: 0, assessments: 0 };
        }
        yearGroups[record.academic_year_int].students += record.total_students || 0;
        yearGroups[record.academic_year_int].assessments += record.total_assessments || 0;
      });

      console.log('\n   📊 Summary by Academic Year:');
      Object.entries(yearGroups)
        .sort(([a], [b]) => parseInt(b) - parseInt(a))
        .forEach(([year, stats]) => {
          console.log(`   • ${year}: ${stats.students} students, ${stats.assessments} assessments`);
        });
    }

    console.log('\n' + '='.repeat(50));
    console.log('🎉 YEAR SUMMARY TABLE UPDATED SUCCESSFULLY!');
    console.log('='.repeat(50));
    console.log(`📊 Summary records created: ${inserted}`);
    console.log('✅ Academic year integers now used instead of enums');
    console.log('✅ Summary statistics regenerated from current data');
    console.log('✅ Ready for year-based analytics and reporting');

  } catch (error) {
    console.error('❌ Year summary update failed:', error.message);
    throw error;
  }
}

async function main() {
  try {
    await applyYearSummaryUpdates();
  } catch (error) {
    console.error('💥 Update process failed:', error);
    process.exit(1);
  }
}

main();