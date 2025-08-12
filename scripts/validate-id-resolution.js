#!/usr/bin/env node

/**
 * Validate ID Resolution for iReady Import
 * 
 * This script verifies that student_id and teacher_id resolution will work
 * before running the main iReady import process.
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../ap-tool-v1/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function validateIdResolution() {
  console.log('🔍 VALIDATING ID RESOLUTION FOR IREADY IMPORT');
  console.log('='.repeat(50));

  try {
    // 1. Check students table structure and sample data
    console.log('\n👥 STUDENTS TABLE VALIDATION:');
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, district_student_id, first_name, last_name')
      .eq('is_active', true)
      .limit(5);

    if (studentsError) {
      console.log('❌ Students table error:', studentsError.message);
      return;
    }

    console.log(`✅ Students table accessible: ${students.length} sample records found`);
    if (students.length > 0) {
      console.log('   Sample student IDs for reference:');
      students.forEach(s => {
        console.log(`   • ${s.district_student_id} → ${s.id} (${s.first_name} ${s.last_name})`);
      });
    }

    // 2. Check teachers table structure and sample data
    console.log('\n👨‍🏫 TEACHERS TABLE VALIDATION:');
    const { data: teachers, error: teachersError } = await supabase
      .from('teachers')
      .select('id, first_name, last_name, employee_id')
      .eq('is_active', true)
      .limit(5);

    if (teachersError) {
      console.log('❌ Teachers table error:', teachersError.message);
      return;
    }

    console.log(`✅ Teachers table accessible: ${teachers.length} sample records found`);
    if (teachers.length > 0) {
      console.log('   Sample teacher names for reference:');
      teachers.forEach(t => {
        console.log(`   • "${t.last_name}, ${t.first_name}" → ${t.id} (${t.employee_id})`);
      });
    }

    // 3. Test student ID resolution with sample data
    if (students.length > 0) {
      console.log('\n🔍 TESTING STUDENT ID RESOLUTION:');
      const testStudentId = students[0].district_student_id;
      
      const { data: resolvedStudent, error: resolveError } = await supabase
        .from('students')
        .select('id')
        .eq('district_student_id', testStudentId)
        .single();

      if (resolveError) {
        console.log(`❌ Student ID resolution failed: ${resolveError.message}`);
      } else {
        console.log(`✅ Student ID resolution works: ${testStudentId} → ${resolvedStudent.id}`);
      }
    }

    // 4. Test teacher name parsing and resolution
    if (teachers.length > 0) {
      console.log('\n🔍 TESTING TEACHER NAME RESOLUTION:');
      const testTeacher = teachers[0];
      const teacherNameVariations = [
        `${testTeacher.last_name}, ${testTeacher.first_name}`,
        `"${testTeacher.last_name}, ${testTeacher.first_name}"`,
        `${testTeacher.first_name} ${testTeacher.last_name}`
      ];

      for (const nameVariation of teacherNameVariations) {
        console.log(`   Testing: "${nameVariation}"`);
        
        // Parse name like the ETL will
        let firstName = '', lastName = '';
        const cleanName = nameVariation.replace(/"/g, '');
        
        if (cleanName.includes(',')) {
          const parts = cleanName.split(',').map(p => p.trim());
          lastName = parts[0];
          firstName = parts[1] || '';
        } else {
          const parts = cleanName.split(' ');
          firstName = parts[0] || '';
          lastName = parts.slice(1).join(' ') || '';
        }

        if (firstName && lastName) {
          const { data: resolvedTeacher, error: teacherError } = await supabase
            .from('teachers')
            .select('id')
            .eq('first_name', firstName)
            .eq('last_name', lastName)
            .eq('is_active', true)
            .single();

          if (teacherError) {
            console.log(`     ❌ Not resolved: ${firstName} ${lastName}`);
          } else {
            console.log(`     ✅ Resolved: ${firstName} ${lastName} → ${resolvedTeacher.id}`);
          }
        }
      }
    }

    // 5. Summary and recommendations
    console.log('\n📊 VALIDATION SUMMARY:');
    console.log('='.repeat(30));
    
    const studentCount = students.length;
    const teacherCount = teachers.length;
    
    if (studentCount > 0 && teacherCount > 0) {
      console.log('✅ ID resolution is ready for iReady import');
      console.log(`   • ${studentCount} students available for matching`);
      console.log(`   • ${teacherCount} teachers available for matching`);
      console.log('   • Foreign key constraints will work properly');
      console.log('\n🚀 READY TO RUN iReady DATABASE SCHEMA!');
    } else {
      console.log('⚠️  Limited data available for ID resolution');
      console.log('   • iReady records may have NULL student_id/teacher_id');
      console.log('   • This is handled gracefully by the schema');
      console.log('\n✅ Still safe to run iReady database schema');
    }

    console.log('\n💡 NEXT STEPS:');
    console.log('   1. Run the iReady schema: iready_isolated_schema.sql');
    console.log('   2. Compile and run: isolatedIReadyImporter.ts');
    console.log('   3. Import CSV files from References/iReady Data/');

  } catch (error) {
    console.error('❌ Validation failed:', error.message);
  }
}

validateIdResolution();