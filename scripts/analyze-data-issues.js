#!/usr/bin/env node

/**
 * Analyze Data Issues in iReady and Students Tables
 * 
 * This script investigates the academic year mapping and district_student_id format issues
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../ap-tool-v1/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function analyzeDataIssues() {
  console.log('🔍 ANALYZING DATA ISSUES');
  console.log('='.repeat(50));

  try {
    // 1. Analyze academic year mapping in iReady data
    console.log('\n📅 ACADEMIC YEAR MAPPING ANALYSIS:');
    const { data: ireadyData } = await supabase
      .from('iready_diagnostic_results')
      .select('academic_year, school_year')
      .limit(10);

    if (ireadyData && ireadyData.length > 0) {
      console.log('Current iReady academic year mapping:');
      const uniqueCombinations = [...new Set(ireadyData.map(row => 
        `${row.academic_year} → ${row.school_year}`
      ))];
      
      uniqueCombinations.forEach(combo => {
        console.log(`  • ${combo}`);
      });

      console.log('\n💡 PROPOSED CORRECTION:');
      uniqueCombinations.forEach(combo => {
        const [enumValue, schoolYear] = combo.split(' → ');
        const firstYear = schoolYear.split('-')[0];
        console.log(`  • ${enumValue} → ${schoolYear} should map to academic_year: ${firstYear}`);
      });
    } else {
      console.log('No iReady data found for analysis');
    }

    // 2. Analyze district_student_id format in students table
    console.log('\n👥 DISTRICT STUDENT ID FORMAT ANALYSIS:');
    const { data: studentsData } = await supabase
      .from('students')
      .select('district_student_id, first_name, last_name')
      .limit(20);

    if (studentsData && studentsData.length > 0) {
      console.log('Current district_student_id formats in students table:');
      studentsData.forEach(student => {
        const id = student.district_student_id;
        const length = id ? id.length : 0;
        const isNumeric = id && /^\d+$/.test(id);
        console.log(`  • ${id} (${length} chars, ${isNumeric ? 'numeric' : 'non-numeric'}) - ${student.first_name} ${student.last_name}`);
      });

      // Analyze ID patterns
      const idLengths = studentsData.map(s => s.district_student_id?.length || 0);
      const numericIds = studentsData.filter(s => s.district_student_id && /^\d+$/.test(s.district_student_id));
      const nonNumericIds = studentsData.filter(s => s.district_student_id && !/^\d+$/.test(s.district_student_id));

      console.log('\n📊 STUDENT ID STATISTICS:');
      console.log(`  • Total students analyzed: ${studentsData.length}`);
      console.log(`  • Numeric IDs: ${numericIds.length}`);
      console.log(`  • Non-numeric IDs: ${nonNumericIds.length}`);
      console.log(`  • ID length range: ${Math.min(...idLengths)} - ${Math.max(...idLengths)} characters`);
      
      // Check for leading zeros or formatting issues
      const potentialIssues = studentsData.filter(s => {
        const id = s.district_student_id;
        return id && (id.startsWith('0') || id.length < 4 || id.length > 10);
      });

      if (potentialIssues.length > 0) {
        console.log(`  • Potential formatting issues: ${potentialIssues.length} IDs`);
        potentialIssues.forEach(student => {
          console.log(`    - ${student.district_student_id} (${student.first_name} ${student.last_name})`);
        });
      }
    }

    // 3. Compare iReady CSV student IDs with database student IDs
    console.log('\n🔗 IREADY VS STUDENTS ID COMPARISON:');
    const { data: ireadyIds } = await supabase
      .from('iready_diagnostic_results')
      .select('district_student_id, student_name')
      .limit(10);

    if (ireadyIds && ireadyIds.length > 0) {
      console.log('iReady CSV student IDs:');
      ireadyIds.forEach(record => {
        const id = record.district_student_id;
        const length = id ? id.length : 0;
        const isNumeric = id && /^\d+$/.test(id);
        console.log(`  • ${id} (${length} chars, ${isNumeric ? 'numeric' : 'non-numeric'}) - ${record.student_name}`);
      });

      // Try to find matches
      console.log('\n🔍 ATTEMPTING ID MATCHES:');
      for (const ireadyRecord of ireadyIds.slice(0, 5)) {
        const ireadyId = ireadyRecord.district_student_id;
        
        // Try exact match
        const { data: exactMatch } = await supabase
          .from('students')
          .select('district_student_id, first_name, last_name')
          .eq('district_student_id', ireadyId)
          .single();

        if (exactMatch) {
          console.log(`  ✅ EXACT MATCH: ${ireadyId} → ${exactMatch.first_name} ${exactMatch.last_name}`);
        } else {
          // Try padded matches (add leading zeros)
          const paddedId = ireadyId.padStart(7, '0');
          const { data: paddedMatch } = await supabase
            .from('students')
            .select('district_student_id, first_name, last_name')
            .eq('district_student_id', paddedId)
            .single();

          if (paddedMatch) {
            console.log(`  🔄 PADDED MATCH: ${ireadyId} → ${paddedId} (${paddedMatch.first_name} ${paddedMatch.last_name})`);
          } else {
            // Try removing leading zeros
            const unpaddedId = ireadyId.replace(/^0+/, '');
            const { data: unpaddedMatch } = await supabase
              .from('students')
              .select('district_student_id, first_name, last_name')
              .eq('district_student_id', unpaddedId)
              .single();

            if (unpaddedMatch) {
              console.log(`  🔄 UNPADDED MATCH: ${ireadyId} → ${unpaddedId} (${unpaddedMatch.first_name} ${unpaddedMatch.last_name})`);
            } else {
              console.log(`  ❌ NO MATCH: ${ireadyId} (${ireadyRecord.student_name})`);
            }
          }
        }
      }
    }

    // 4. Recommendations
    console.log('\n💡 RECOMMENDED CORRECTIONS:');
    console.log('='.repeat(30));
    
    console.log('\n1. ACADEMIC YEAR MAPPING:');
    console.log('   • Change iready_academic_year enum to use integer year (2024, 2023, 2022)');
    console.log('   • Extract first year from school_year column');
    console.log('   • Update existing records accordingly');
    
    console.log('\n2. DISTRICT STUDENT ID FORMAT:');
    console.log('   • Investigate if IDs should be 7-8 digit format');
    console.log('   • Check for leading zero issues');
    console.log('   • Standardize format across both tables');
    console.log('   • Create mapping function for ID resolution');

    console.log('\n3. NEXT STEPS:');
    console.log('   • Create migration script for academic year changes');
    console.log('   • Implement ID format standardization');
    console.log('   • Re-run ID resolution after corrections');

  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
  }
}

analyzeDataIssues();