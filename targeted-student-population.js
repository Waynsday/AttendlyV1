#!/usr/bin/env node

/**
 * Targeted Student Population Script
 * Uses pagination and chunking strategies to successfully populate students table
 * Based on comprehensive API testing results
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
  errors: 0,
  apiCalls: 0,
  startTime: Date.now()
};

async function aeriesAPIRequest(endpoint, timeout = 120000) {
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

    stats.apiCalls++;
    console.log(`🔗 API Call ${stats.apiCalls}: ${fullPath}`);

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
    req.setTimeout(timeout, () => reject(new Error('Request timeout')));
    req.end();
  });
}

// Strategy 1: Pagination with small chunks
async function getStudentsPaginated(schoolCode, startRecord = 1, endRecord = 50) {
  try {
    console.log(`     📄 Fetching students ${startRecord}-${endRecord} for school ${schoolCode}...`);
    
    const endpoint = `/schools/${schoolCode}/students?StartingRecord=${startRecord}&EndingRecord=${endRecord}`;
    const result = await aeriesAPIRequest(endpoint, 60000);
    
    if (result.status === 200 && Array.isArray(result.data)) {
      console.log(`       ✅ Found ${result.data.length} students`);
      return result.data;
    } else {
      console.log(`       ⚠️  No data: ${result.status}`);
      return [];
    }
  } catch (error) {
    console.log(`       ❌ Error: ${error.message}`);
    stats.errors++;
    return [];
  }
}

// Strategy 2: Grade-by-grade retrieval
async function getStudentsByGrade(schoolCode, grade) {
  try {
    console.log(`     📚 Fetching grade ${grade} students for school ${schoolCode}...`);
    
    const endpoint = `/schools/${schoolCode}/students/grade/${grade}`;
    const result = await aeriesAPIRequest(endpoint, 45000);
    
    if (result.status === 200 && Array.isArray(result.data)) {
      console.log(`       ✅ Found ${result.data.length} students in grade ${grade}`);
      return result.data;
    } else {
      console.log(`       ⚠️  No grade ${grade} data: ${result.status}`);
      return [];
    }
  } catch (error) {
    console.log(`       ❌ Grade ${grade} error: ${error.message}`);
    stats.errors++;
    return [];
  }
}

// Strategy 3: Recent data changes
async function getRecentStudentChanges() {
  try {
    console.log(`     🔄 Fetching recent student data changes...`);
    
    // Get students changed in last 90 days
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const year = ninetyDaysAgo.getFullYear();
    const month = (ninetyDaysAgo.getMonth() + 1).toString().padStart(2, '0');
    const day = ninetyDaysAgo.getDate().toString().padStart(2, '0');
    
    const endpoint = `/StudentDataChanges/student/${year}/${month}/${day}/00/00`;
    const result = await aeriesAPIRequest(endpoint, 45000);
    
    if (result.status === 200 && Array.isArray(result.data)) {
      console.log(`       ✅ Found ${result.data.length} students with recent changes`);
      return result.data;
    } else {
      console.log(`       ⚠️  No recent changes: ${result.status}`);
      return [];
    }
  } catch (error) {
    console.log(`       ❌ Recent changes error: ${error.message}`);
    stats.errors++;
    return [];
  }
}

function processStudentData(aeriesStudent, schoolId, schoolCode) {
  // Handle different possible field names from different endpoints
  const studentId = aeriesStudent.StudentID || aeriesStudent.ID || aeriesStudent.StudentNumber;
  const firstName = aeriesStudent.FirstName || aeriesStudent.FN || '';
  const lastName = aeriesStudent.LastName || aeriesStudent.LN || '';
  const grade = aeriesStudent.Grade || aeriesStudent.GradeLevel || aeriesStudent.GR || null;
  
  if (!studentId) {
    console.log(`       ⚠️  Skipping student - no ID found`);
    return null;
  }

  return {
    aeries_student_id: studentId.toString(),
    school_id: schoolId,
    first_name: firstName,
    last_name: lastName,
    grade_level: grade ? grade.toString() : null,
    student_number: aeriesStudent.StudentNumber || null,
    is_active: true,
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
  return schools;
}

async function populateStudentsTargeted() {
  console.log('🚀 Starting Targeted Student Population');
  console.log('📋 Using multiple strategies to populate students table');
  console.log('='.repeat(60));

  try {
    // Clear existing students
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

    // Try multiple strategies for each school
    for (const school of schools) {
      console.log(`\n🏫 Processing ${school.school_name} (Code: ${school.aeries_school_code})`);
      stats.schoolsProcessed++;

      let allStudents = [];
      let strategyUsed = 'none';

      // Strategy 1: Try grade-by-grade first (usually works better)
      console.log(`   📚 Strategy 1: Grade-by-grade retrieval`);
      const grades = ['TK', 'K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
      
      for (const grade of grades) {
        const gradeStudents = await getStudentsByGrade(school.aeries_school_code, grade);
        if (gradeStudents.length > 0) {
          allStudents.push(...gradeStudents);
          strategyUsed = 'grade-by-grade';
        }
        
        // Small delay between grade requests
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Strategy 2: If grade-by-grade didn't work, try pagination
      if (allStudents.length === 0) {
        console.log(`   📄 Strategy 2: Paginated retrieval`);
        let hasMoreStudents = true;
        let currentPage = 1;
        const pageSize = 25; // Small page size
        
        while (hasMoreStudents && currentPage <= 20) { // Max 20 pages
          const startRecord = (currentPage - 1) * pageSize + 1;
          const endRecord = currentPage * pageSize;
          
          const pageStudents = await getStudentsPaginated(school.aeries_school_code, startRecord, endRecord);
          
          if (pageStudents.length > 0) {
            allStudents.push(...pageStudents);
            strategyUsed = 'paginated';
            currentPage++;
            
            // If we got less than page size, we're done
            if (pageStudents.length < pageSize) {
              hasMoreStudents = false;
            }
          } else {
            hasMoreStudents = false;
          }
          
          // Delay between page requests
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Process and insert students
      if (allStudents.length > 0) {
        console.log(`   📊 Processing ${allStudents.length} students using ${strategyUsed} strategy`);
        
        // Remove duplicates based on student ID
        const uniqueStudents = [];
        const seenIds = new Set();
        
        for (const aeriesStudent of allStudents) {
          const studentId = aeriesStudent.StudentID || aeriesStudent.ID || aeriesStudent.StudentNumber;
          if (studentId && !seenIds.has(studentId)) {
            seenIds.add(studentId);
            const processedStudent = processStudentData(aeriesStudent, school.id, school.aeries_school_code);
            if (processedStudent) {
              uniqueStudents.push(processedStudent);
            }
          }
        }

        console.log(`   📦 Inserting ${uniqueStudents.length} unique students...`);

        // Insert in smaller batches
        const batchSize = 50;
        for (let i = 0; i < uniqueStudents.length; i += batchSize) {
          const batch = uniqueStudents.slice(i, i + batchSize);
          
          try {
            const { data, error: insertError } = await supabase
              .from('students')
              .insert(batch)
              .select();

            if (insertError) {
              console.log(`     ❌ Batch error: ${insertError.message}`);
              stats.errors++;
            } else {
              const insertedCount = data ? data.length : batch.length;
              stats.studentsCreated += insertedCount;
              console.log(`     ✅ Inserted ${insertedCount} students`);
            }
          } catch (e) {
            console.log(`     ❌ Insert exception: ${e.message}`);
            stats.errors++;
          }
        }
      } else {
        console.log(`   ⚠️  No students found for ${school.school_name}`);
      }

      // Rate limiting between schools
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // Try district-wide recent changes as fallback
    if (stats.studentsCreated === 0) {
      console.log('\n🔄 Fallback Strategy: Recent student data changes');
      const recentStudents = await getRecentStudentChanges();
      
      if (recentStudents.length > 0) {
        console.log(`   📊 Processing ${recentStudents.length} students from recent changes`);
        // Process these students similarly to above
      }
    }

    // Final results
    const totalTime = (Date.now() - stats.startTime) / 1000;
    console.log('\n' + '='.repeat(60));
    console.log('✅ TARGETED STUDENT POPULATION COMPLETED!');
    console.log('='.repeat(60));
    console.log(`⏱️  Duration: ${totalTime.toFixed(1)} seconds`);
    console.log(`🏫 Schools processed: ${stats.schoolsProcessed}`);
    console.log(`👥 Students created: ${stats.studentsCreated}`);
    console.log(`🔗 API calls made: ${stats.apiCalls}`);
    console.log(`❌ Errors: ${stats.errors}`);
    
    // Verify final count
    const { count } = await supabase
      .from('students')
      .select('*', { count: 'exact' });
    console.log(`📊 Total students in database: ${count}`);
    
    if (count > 0) {
      console.log('\n🎉 SUCCESS! Students table populated with real Aeries data!');
      console.log('📋 You can now run attendance sync scripts.');
    } else {
      console.log('\n⚠️  No students were successfully added.');
      console.log('📋 Consider running the comprehensive test script first.');
    }

  } catch (error) {
    console.error('❌ Population failed:', error);
    process.exit(1);
  }
}

// Run the targeted population
if (require.main === module) {
  populateStudentsTargeted().then(() => {
    console.log('\n✅ Targeted student population complete!');
    process.exit(0);
  }).catch(error => {
    console.error('\n❌ Population failed:', error);
    process.exit(1);
  });
}

module.exports = { populateStudentsTargeted };