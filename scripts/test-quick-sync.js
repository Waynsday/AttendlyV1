#!/usr/bin/env node

const https = require('https');
const { createClient } = require('@supabase/supabase-js');

const AERIES_API_KEY = 'e815603e5ccc48aab197771eeda7a4c6';
const AERIES_BASE_URL = 'romolandapi.aeries.net';
const SUPABASE_URL = 'https://xadusbywqywarbltelmj.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhZHVzYnl3cXl3YXJibHRlbG1qIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzcyODc1NywiZXhwIjoyMDY5MzA0NzU3fQ.uAByYhX1Ll5COBFIrLyJN-89q5xMqpPs3GZgcwosvRk';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function aeriesAPIRequest(endpoint) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: AERIES_BASE_URL,
      path: '/admin/api/v5' + endpoint,
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
    req.setTimeout(15000, () => reject(new Error('Request timeout')));
    req.end();
  });
}

async function quickTestBatch() {
  console.log('🧪 Quick test batch with detailed logging...');
  
  // Get 2 students from school 120 (known to have good data)
  const studentsResult = await aeriesAPIRequest('/schools/120/students');
  
  if (studentsResult.status !== 200 || !Array.isArray(studentsResult.data)) {
    console.log('❌ Failed to get students');
    console.log('Status:', studentsResult.status);
    console.log('Data type:', typeof studentsResult.data);
    console.log('Data preview:', JSON.stringify(studentsResult.data).substring(0, 200));
    return;
  }
  
  const testStudents = studentsResult.data.slice(0, 2);
  console.log(`Testing with ${testStudents.length} students from school 120`);
  
  for (let student of testStudents) {
    console.log(`\n👤 Processing: ${student.FirstName} ${student.LastName} ID: ${student.StudentID}`);
    
    try {
      // Get attendance summary
      const summaryResult = await aeriesAPIRequest(`/schools/120/AttendanceHistory/summary/${student.StudentID}`);
      
      if (summaryResult.status === 200 && Array.isArray(summaryResult.data) && summaryResult.data.length > 0) {
        const studentData = summaryResult.data[0];
        if (studentData.HistorySummaries && studentData.HistorySummaries.length > 0) {
          
          // Find 2024-2025 data
          const currentYear = studentData.HistorySummaries.find(h => h.SchoolYear === '2024-2025');
          if (currentYear) {
            const attendanceRate = currentYear.DaysEnrolled > 0 ? 
              ((currentYear.DaysPresent / currentYear.DaysEnrolled) * 100).toFixed(2) : '0.00';
            
            console.log(`   📊 Found real data: ${attendanceRate}% attendance`);
            console.log(`   📊 Days: ${currentYear.DaysPresent}/${currentYear.DaysEnrolled}`);
            
            const record = {
              aeries_student_id: student.StudentID.toString(),
              school_code: '120',
              school_year: currentYear.SchoolYear,
              days_enrolled: currentYear.DaysEnrolled || 0,
              days_present: currentYear.DaysPresent || 0,
              days_absent: currentYear.DaysAbsence || 0,
              days_excused: currentYear.DaysExcused || 0,
              days_unexcused: currentYear.DaysUnexcused || 0,
              days_tardy: currentYear.DaysTardy || 0,
              days_truancy: currentYear.DaysOfTruancy || 0,
              days_suspension: currentYear.DaysSuspension || 0,
              attendance_rate: parseFloat(attendanceRate),
              sync_timestamp: new Date().toISOString(),
              data_source: 'quick_test'
            };
            
            console.log('   💾 Inserting record...');
            
            const { data: insertData, error: insertError } = await supabase
              .from('attendance_records')
              .insert([record]);
              
            if (insertError) {
              console.log('   ❌ Insert failed:', insertError.message);
              console.log('   📋 Error code:', insertError.code);
              console.log('   📋 Error details:', insertError.details);
            } else {
              console.log('   ✅ Insert successful!');
              
              // Verify the record exists
              const { data: verifyData, error: verifyError } = await supabase
                .from('attendance_records')
                .select('*')
                .eq('aeries_student_id', student.StudentID.toString())
                .eq('school_year', '2024-2025');
                
              if (verifyError) {
                console.log('   ❌ Verification error:', verifyError.message);
              } else {
                console.log(`   ✅ Verification: Found ${verifyData.length} records`);
                if (verifyData.length > 0) {
                  console.log(`   📋 Record data: ${verifyData[0].attendance_rate}% attendance`);
                }
              }
            }
          } else {
            console.log('   ⚠️  No 2024-2025 data found');
          }
        } else {
          console.log('   ⚠️  No attendance summaries found');
        }
      } else {
        console.log('   ❌ No attendance data from API');
      }
      
    } catch (error) {
      console.log('   ❌ Error:', error.message);
    }
  }
  
  // Final count check
  console.log('\n📊 Final database count...');
  const { count } = await supabase
    .from('attendance_records')
    .select('*', { count: 'exact', head: true });
    
  console.log('Total records now in database:', count);
  
  if (count > 0) {
    console.log('\n🎉 SUCCESS! Real attendance data is being synced to Supabase!');
  } else {
    console.log('\n❌ Still no records in database - need to investigate further');
  }
}

quickTestBatch().catch(console.error);