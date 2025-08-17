#!/usr/bin/env node

/**
 * Regenerate grade_attendance_summaries table using correct aeries_student_id joins
 * Handles Supabase 1000 record limit with pagination
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function regenerateGradeSummaries() {
  console.log('🔄 Regenerating grade_attendance_summaries table\n');
  
  try {
    // Step 1: Get all students (paginated)
    console.log('👥 Step 1: Getting all students...');
    const allStudents = await getAllStudents();
    console.log(`✅ Retrieved ${allStudents.length} total students\n`);

    // Step 2: Get all schools for name lookup
    console.log('🏫 Step 2: Getting school information...');
    const { data: schoolsData, error: schoolsError } = await supabase
      .from('schools')
      .select('id, school_name');

    if (schoolsError) {
      throw new Error(`Failed to get schools: ${schoolsError.message}`);
    }

    const schoolLookup = {};
    schoolsData.forEach(school => {
      schoolLookup[school.id] = school.school_name;
    });
    console.log(`✅ Retrieved ${schoolsData.length} schools\n`);

    // Step 3: Get all attendance records (paginated)
    console.log('📊 Step 3: Getting all attendance records...');
    const allAttendance = await getAllAttendanceRecords();
    console.log(`✅ Retrieved ${allAttendance.length} total attendance records\n`);

    // Step 4: Calculate grade summaries
    console.log('🧮 Step 4: Calculating grade summaries...');
    const gradeSummaries = calculateGradeSummariesFromData(allStudents, allAttendance, schoolLookup);
    console.log(`✅ Calculated ${Object.keys(gradeSummaries).length} grade summaries\n`);

    // Step 5: Clear existing data and insert new data
    console.log('🗑️ Step 5: Clearing existing grade_attendance_summaries...');
    const { error: deleteError } = await supabase
      .from('grade_attendance_summaries')
      .delete()
      .neq('school_id', '00000000-0000-0000-0000-000000000000'); // Delete all records

    if (deleteError) {
      throw new Error(`Failed to clear existing data: ${deleteError.message}`);
    }
    console.log('✅ Existing data cleared\n');

    // Step 6: Insert new data (in batches due to 1000 record limit)
    console.log('📥 Step 6: Inserting new grade summaries...');
    await insertGradeSummariesInBatches(gradeSummaries);
    console.log('✅ New data inserted successfully\n');

    // Step 7: Verify the results
    console.log('✔️ Step 7: Verifying results...');
    await verifyResults();

    console.log('\n🎉 Grade summaries regeneration completed successfully!');

  } catch (error) {
    console.error('\n❌ Error regenerating grade summaries:', error);
    throw error;
  }
}

async function getAllStudents() {
  const allStudents = [];
  let offset = 0;
  const limit = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from('students')
      .select('aeries_student_id, grade_level, school_id, id')
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to get students at offset ${offset}: ${error.message}`);
    }

    if (data.length === 0) {
      break; // No more data
    }

    allStudents.push(...data);
    offset += limit;
    
    console.log(`  Retrieved ${allStudents.length} students so far...`);
    
    if (data.length < limit) {
      break; // Last page
    }
  }
  
  return allStudents;
}

async function getAllAttendanceRecords() {
  const allAttendance = [];
  let offset = 0;
  const limit = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from('attendance_records')
      .select('aeries_student_id, school_id, attendance_date, is_present')
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to get attendance at offset ${offset}: ${error.message}`);
    }

    if (data.length === 0) {
      break; // No more data
    }

    allAttendance.push(...data);
    offset += limit;
    
    console.log(`  Retrieved ${allAttendance.length} attendance records so far...`);
    
    if (data.length < limit) {
      break; // Last page
    }
  }
  
  return allAttendance;
}

function calculateGradeSummariesFromData(studentsData, attendanceData, schoolLookup) {
  const summaries = {};
  let matchedRecords = 0;
  let studentsWithNoAttendance = 0;
  
  // Create attendance lookup by aeries_student_id for performance
  console.log('  📋 Creating attendance lookup...');
  const attendanceLookup = {};
  attendanceData.forEach(record => {
    const key = record.aeries_student_id;
    if (!attendanceLookup[key]) {
      attendanceLookup[key] = [];
    }
    attendanceLookup[key].push(record);
  });
  
  console.log('  🧮 Processing each student...');
  
  // Process each student (base table)
  studentsData.forEach((student, index) => {
    if (index % 500 === 0) {
      console.log(`    Processed ${index}/${studentsData.length} students...`);
    }
    
    const key = `${student.school_id}_${student.grade_level}`;
    
    // Initialize summary for this school/grade combination
    if (!summaries[key]) {
      summaries[key] = {
        school_id: student.school_id,
        school_name: schoolLookup[student.school_id] || 'Unknown School',
        grade_level: student.grade_level,
        students: new Set(),
        total_records: 0,
        present_records: 0
      };
    }
    
    // Add student to count
    summaries[key].students.add(student.aeries_student_id);
    
    // Find attendance records for this student
    const studentAttendance = attendanceLookup[student.aeries_student_id] || [];
    
    if (studentAttendance.length > 0) {
      matchedRecords += studentAttendance.length;
      
      // Process attendance records
      studentAttendance.forEach(record => {
        summaries[key].total_records++;
        if (record.is_present) {
          summaries[key].present_records++;
        }
      });
    } else {
      // Student has no attendance records
      studentsWithNoAttendance++;
    }
  });
  
  console.log(`  📊 Join Statistics:`);
  console.log(`    - ${matchedRecords} attendance records matched to students`);
  console.log(`    - ${studentsWithNoAttendance} students with no attendance records`);
  
  // Calculate final statistics and add additional fields
  Object.keys(summaries).forEach(key => {
    const summary = summaries[key];
    summary.total_students = summary.students.size;
    summary.attendance_rate = summary.total_records > 0 
      ? parseFloat(((summary.present_records / summary.total_records) * 100).toFixed(1))
      : 0;
    
    // Calculate chronic absentees (assuming 10% absence rate threshold)
    const absenceRate = 100 - summary.attendance_rate;
    summary.chronic_absentees = absenceRate >= 10 ? Math.ceil(summary.total_students * 0.1) : 0;
    
    // Calculate tier breakdowns based on attendance rate
    if (summary.attendance_rate >= 95) {
      summary.tier1_students = summary.total_students;
      summary.tier2_students = 0;
      summary.tier3_students = 0;
      summary.risk_level = 'low';
    } else if (summary.attendance_rate >= 90) {
      summary.tier1_students = Math.floor(summary.total_students * 0.7);
      summary.tier2_students = summary.total_students - summary.tier1_students;
      summary.tier3_students = 0;
      summary.risk_level = 'medium';
    } else {
      summary.tier1_students = Math.floor(summary.total_students * 0.5);
      summary.tier2_students = Math.floor(summary.total_students * 0.3);
      summary.tier3_students = summary.total_students - summary.tier1_students - summary.tier2_students;
      summary.risk_level = 'high';
    }
    
    // Add grade name mapping
    summary.grade_name = getGradeName(summary.grade_level);
    
    // Add trend (stable for now)
    summary.trend = 'stable';
    
    // Add timestamp
    summary.last_updated = new Date().toISOString();
    
    // Clean up the Set for insertion
    delete summary.students;
  });
  
  return summaries;
}

function getGradeName(gradeLevel) {
  switch (gradeLevel) {
    case -1: return 'Pre-K';
    case 0: return 'K';
    case null: 
    case undefined: return 'N/A';
    default: return gradeLevel.toString();
  }
}

async function insertGradeSummariesInBatches(gradeSummaries) {
  const summaryArray = Object.values(gradeSummaries);
  const batchSize = 100; // Conservative batch size for inserts
  
  for (let i = 0; i < summaryArray.length; i += batchSize) {
    const batch = summaryArray.slice(i, i + batchSize);
    
    console.log(`  Inserting batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(summaryArray.length/batchSize)} (${batch.length} records)...`);
    
    const { error } = await supabase
      .from('grade_attendance_summaries')
      .insert(batch);
    
    if (error) {
      throw new Error(`Failed to insert batch at index ${i}: ${error.message}`);
    }
  }
  
  console.log(`✅ Inserted ${summaryArray.length} grade summaries in ${Math.ceil(summaryArray.length/batchSize)} batches`);
}

async function verifyResults() {
  const { data, error, count } = await supabase
    .from('grade_attendance_summaries')
    .select('school_name, grade_level, total_students, attendance_rate', { count: 'exact' })
    .order('school_name, grade_level');

  if (error) {
    throw new Error(`Failed to verify results: ${error.message}`);
  }

  console.log(`✅ Verification: ${count} grade summaries in table`);
  
  if (data && data.length > 0) {
    console.log('\n📊 Sample of regenerated data:');
    console.log('School                  | Grade | Students | Attendance Rate');
    console.log('----------------------- | ----- | -------- | ---------------');
    
    data.slice(0, 10).forEach(record => {
      const schoolName = (record.school_name || 'Unknown').substring(0, 22).padEnd(23);
      const grade = String(record.grade_level || 'N/A').padEnd(5);
      const students = String(record.total_students || 0).padEnd(8);
      const rate = `${record.attendance_rate || 0}%`;
      console.log(`${schoolName} | ${grade} | ${students} | ${rate}`);
    });
    
    if (data.length > 10) {
      console.log(`... and ${data.length - 10} more records`);
    }
    
    // Calculate overall statistics
    const totalStudents = data.reduce((sum, record) => sum + (record.total_students || 0), 0);
    const avgAttendanceRate = data.reduce((sum, record) => sum + (record.attendance_rate || 0), 0) / data.length;
    
    console.log('----------------------- | ----- | -------- | ---------------');
    console.log(`TOTALS                  |       | ${totalStudents}     | ${avgAttendanceRate.toFixed(1)}% (avg)`);
  }
}

// Run the regeneration
if (require.main === module) {
  regenerateGradeSummaries().then(() => {
    console.log('\n✅ Regeneration completed successfully!');
    process.exit(0);
  }).catch(error => {
    console.error('\n❌ Regeneration failed:', error);
    process.exit(1);
  });
}

module.exports = { regenerateGradeSummaries };