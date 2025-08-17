#!/usr/bin/env node

/**
 * Populate Students Table from Aeries - Get all students from each school
 * Uses /schools/{SchoolCode}/students endpoint to populate students table
 * This will enable full-school-year-sync.js to work properly
 */

const https = require('https');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const AERIES_API_KEY = process.env.AERIES_API_KEY;
const AERIES_BASE_URL = 'romolandapi.aeries.net';

const stats = {
  schoolsProcessed: 0,
  studentsCreated: 0,
  studentsUpdated: 0,
  errors: 0,
  startTime: Date.now()
};

async function aeriesAPIRequest(endpoint) {
  return new Promise((resolve, reject) => {
    const fullPath = `/admin/api/v5${endpoint}`;
    const options = {
      hostname: AERIES_BASE_URL,
      path: fullPath,
      method: 'GET',
      headers: {
        'AERIES-CERT': AERIES_API_KEY,
        'Accept': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.setTimeout(120000, () => reject(new Error('Request timeout')));
    req.end();
  });
}

async function getSchoolStudents(schoolCode) {
  try {
    console.log(`     👥 Fetching students for school ${schoolCode}...`);
    console.log(`     🔗 Endpoint: /schools/${schoolCode}/students`);
    
    const result = await aeriesAPIRequest(`/schools/${schoolCode}/students`);
    
    if (result.status === 200 && Array.isArray(result.data)) {
      console.log(`       ✅ Found ${result.data.length} students`);
      
      // Show sample student data structure
      if (result.data.length > 0) {
        const sampleStudent = result.data[0];
        console.log(`       📄 Sample student fields: ${Object.keys(sampleStudent).join(', ')}`);
      }
      
      return result.data;
    } else {
      console.log(`       ⚠️  No students found for school ${schoolCode} (Status: ${result.status})`);
      if (typeof result.data === 'string') {
        console.log(`       📄 Response: ${result.data.substring(0, 200)}`);
      }
      return [];
    }
  } catch (error) {
    console.log(`       ❌ Error fetching students for school ${schoolCode}: ${error.message}`);
    stats.errors++;
    return [];
  }
}

function processStudentData(aeriesStudent, schoolId, schoolCode) {
  // Map Aeries student data to our students table structure
  return {
    aeries_student_id: aeriesStudent.StudentID || aeriesStudent.ID,
    school_id: schoolId,
    first_name: aeriesStudent.FirstName || null,
    last_name: aeriesStudent.LastName || null,
    grade_level: aeriesStudent.Grade || aeriesStudent.GradeLevel || null,
    student_number: aeriesStudent.StudentNumber || null,
    is_active: true, // Assume active if returned by API
    enrollment_date: aeriesStudent.EnrollmentDate || null,
    birth_date: aeriesStudent.BirthDate || null,
    gender: aeriesStudent.Gender || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

async function getActiveSchools() {
  console.log('🏫 Fetching active schools from database...');
  
  const { data: schools, error } = await supabase
    .from('schools')
    .select('id, school_name, aeries_school_code')
    .eq('is_active', true)
    .order('aeries_school_code');

  if (error) {
    throw new Error(`Failed to fetch schools: ${error.message}`);
  }

  console.log(`✅ Found ${schools.length} active schools`);
  schools.forEach(school => {
    console.log(`   ${school.school_name} - Code: ${school.aeries_school_code}`);
  });

  return schools;
}

async function syncStudentsFromAeries() {
  console.log('🚀 Starting Students Sync from Aeries');
  console.log('📚 Populating students table to enable attendance sync');
  console.log('============================================================');
  
  try {
    // Clear existing students first (optional - comment out if you want to keep existing)
    console.log('🧹 Clearing existing students...');
    const { error: deleteError } = await supabase
      .from('students')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (deleteError) {
      console.log(`❌ Error clearing students: ${deleteError.message}`);
    } else {
      console.log('✅ Existing students cleared');
    }

    // Get all active schools
    const schools = await getActiveSchools();
    
    if (schools.length === 0) {
      console.log('❌ No active schools found');
      return;
    }

    // Process each school
    for (const school of schools) {
      console.log(`\n🏫 Processing ${school.school_name} (Code: ${school.aeries_school_code})`);
      stats.schoolsProcessed++;

      // Get students from Aeries for this school
      const aeriesStudents = await getSchoolStudents(school.aeries_school_code);
      
      if (aeriesStudents.length === 0) {
        console.log(`   ⚠️  No students found for ${school.school_name}`);
        continue;
      }

      // Process students in batches
      const batchSize = 100;
      const batches = [];
      
      for (let i = 0; i < aeriesStudents.length; i += batchSize) {
        batches.push(aeriesStudents.slice(i, i + batchSize));
      }

      console.log(`   📦 Processing ${aeriesStudents.length} students in ${batches.length} batches...`);

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        const studentsToInsert = [];

        batch.forEach(aeriesStudent => {
          const studentData = processStudentData(aeriesStudent, school.id, school.aeries_school_code);
          studentsToInsert.push(studentData);
        });

        // Insert batch
        try {
          const { data, error: insertError } = await supabase
            .from('students')
            .insert(studentsToInsert)
            .select();

          if (insertError) {
            console.log(`     ❌ Batch ${batchIndex + 1} insert error: ${insertError.message}`);
            stats.errors++;
          } else {
            const insertedCount = data ? data.length : studentsToInsert.length;
            stats.studentsCreated += insertedCount;
            console.log(`     ✅ Batch ${batchIndex + 1}: Inserted ${insertedCount} students`);
          }
        } catch (e) {
          console.log(`     ❌ Batch ${batchIndex + 1} exception: ${e.message}`);
          stats.errors++;
        }

        // Rate limiting between batches
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Rate limiting between schools
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Final results
    const totalTime = (Date.now() - stats.startTime) / 1000;
    console.log('\n' + '='.repeat(60));
    console.log('✅ STUDENTS SYNC COMPLETED!');
    console.log('='.repeat(60));
    console.log(`⏱️  Duration: ${totalTime.toFixed(1)} seconds (${(totalTime/60).toFixed(1)} minutes)`);
    console.log(`🏫 Schools processed: ${stats.schoolsProcessed}`);
    console.log(`👥 Students created: ${stats.studentsCreated}`);
    console.log(`❌ Errors: ${stats.errors}`);
    
    // Verify final count
    const { count } = await supabase
      .from('students')
      .select('*', { count: 'exact' });
    console.log(`📊 Total students in database: ${count}`);
    
    // Show distribution by school
    const { data: schoolStats } = await supabase
      .from('students')
      .select('school_id, schools!inner(school_name, aeries_school_code)')
      .order('school_id');
    
    if (schoolStats && schoolStats.length > 0) {
      const schoolCounts = {};
      schoolStats.forEach(student => {
        const schoolName = student.schools.school_name;
        schoolCounts[schoolName] = (schoolCounts[schoolName] || 0) + 1;
      });
      
      console.log(`📊 Students by school:`);
      Object.entries(schoolCounts).forEach(([school, count]) => {
        console.log(`   ${school}: ${count} students`);
      });
    }

    // Show grade distribution
    const { data: gradeStats } = await supabase
      .from('students')
      .select('grade_level')
      .order('grade_level');
    
    if (gradeStats && gradeStats.length > 0) {
      const gradeCounts = {};
      gradeStats.forEach(student => {
        const grade = student.grade_level || 'Unknown';
        gradeCounts[grade] = (gradeCounts[grade] || 0) + 1;
      });
      
      console.log(`📊 Students by grade:`);
      Object.entries(gradeCounts).sort().forEach(([grade, count]) => {
        console.log(`   Grade ${grade}: ${count} students`);
      });
    }
    
    console.log('\n🎯 Students table is now populated!');
    console.log('📋 You can now run full-school-year-sync.js to generate attendance records');
    
  } catch (error) {
    console.error('❌ Students sync failed:', error);
    process.exit(1);
  }
}

// Run the sync
if (require.main === module) {
  syncStudentsFromAeries().then(() => {
    console.log('\n✅ Students sync complete!');
    process.exit(0);
  }).catch(error => {
    console.error('\n❌ Students sync failed:', error);
    process.exit(1);
  });
}

module.exports = { syncStudentsFromAeries };