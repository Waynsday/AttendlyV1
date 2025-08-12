/**
 * @fileoverview Simple Aeries Usage Examples
 * 
 * COPY-PASTE READY examples showing how to use the Aeries API
 * with just district code, base URL, and certificate.
 */

import { getSimpleAeriesClient, testAeriesConnection } from '@/lib/aeries/simple-aeries-client';

// =====================================================
// Example 1: Test Connection (Simplest)
// =====================================================

export async function testConnection() {
  try {
    console.log('🔍 Testing Aeries connection...');
    
    const isConnected = await testAeriesConnection();
    
    if (isConnected) {
      console.log('✅ Aeries connection successful!');
      return true;
    } else {
      console.log('❌ Aeries connection failed');
      return false;
    }
  } catch (error) {
    console.error('❌ Connection test error:', error);
    return false;
  }
}

// =====================================================
// Example 2: Get Schools (Basic)
// =====================================================

export async function getSchools() {
  try {
    console.log('🏫 Getting schools from Aeries...');
    
    const client = await getSimpleAeriesClient();
    const schools = await client.getSchools();
    
    if (schools.success) {
      console.log('✅ Schools retrieved:', schools.data.length);
      schools.data.forEach(school => {
        console.log(`  - ${school.schoolName} (${school.schoolCode})`);
      });
      return schools.data;
    } else {
      console.log('❌ Failed to get schools');
      return [];
    }
  } catch (error) {
    console.error('❌ Get schools error:', error);
    return [];
  }
}

// =====================================================
// Example 3: Get Attendance for One Day (Simple)
// =====================================================

export async function getAttendanceForOneDay(date = '2024-08-15') {
  try {
    console.log(`📅 Getting attendance for ${date}...`);
    
    const client = await getSimpleAeriesClient();
    const attendance = await client.getAttendanceByDateRange(date, date);
    
    if (attendance.success) {
      console.log(`✅ Found ${attendance.data.length} attendance records`);
      
      // Show first few records as example
      attendance.data.slice(0, 3).forEach(record => {
        console.log(`  - Student ${record.studentNumber}: ${record.dailyStatus}`);
      });
      
      return attendance.data;
    } else {
      console.log('❌ Failed to get attendance');
      return [];
    }
  } catch (error) {
    console.error('❌ Get attendance error:', error);
    return [];
  }
}

// =====================================================
// Example 4: Process Attendance in Batches (Advanced)
// =====================================================

export async function processAttendanceWeek(startDate = '2024-08-15', endDate = '2024-08-21') {
  try {
    console.log(`📊 Processing attendance from ${startDate} to ${endDate}...`);
    
    const client = await getSimpleAeriesClient();
    
    let totalRecords = 0;
    
    const result = await client.processAttendanceBatches(
      startDate,
      endDate,
      async (batch, batchNumber) => {
        console.log(`📦 Processing batch ${batchNumber}: ${batch.length} records`);
        
        // Process each record in the batch
        batch.forEach(record => {
          // Your processing logic here
          if (record.dailyStatus === 'ABSENT') {
            console.log(`⚠️  Absent: Student ${record.studentNumber} on ${record.attendanceDate}`);
          }
        });
        
        totalRecords += batch.length;
      }
    );
    
    console.log(`✅ Processing complete: ${result.totalProcessed} records in ${result.totalBatches} batches`);
    
    if (result.errors.length > 0) {
      console.log(`⚠️  ${result.errors.length} errors occurred`);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Batch processing error:', error);
    return null;
  }
}

// =====================================================
// Example 5: Complete Usage (All in One)
// =====================================================

export async function completeExample() {
  console.log('🚀 Running complete Aeries example...\n');
  
  // Step 1: Test connection
  const connected = await testConnection();
  if (!connected) {
    console.log('❌ Cannot proceed - connection failed');
    return;
  }
  
  console.log('\n');
  
  // Step 2: Get schools
  const schools = await getSchools();
  if (schools.length === 0) {
    console.log('❌ Cannot proceed - no schools found');
    return;
  }
  
  console.log('\n');
  
  // Step 3: Get attendance for one day
  const attendance = await getAttendanceForOneDay('2024-08-15');
  console.log(`📊 Found ${attendance.length} attendance records for today\n`);
  
  // Step 4: Process a week of data
  const result = await processAttendanceWeek('2024-08-15', '2024-08-21');
  
  if (result) {
    console.log('\n🎉 Complete example finished successfully!');
    console.log(`📈 Summary: ${result.totalProcessed} records processed`);
  } else {
    console.log('\n❌ Complete example failed');
  }
}

// =====================================================
// Example 6: Save to Database (Integration)
// =====================================================

export async function syncToDatabase(startDate = '2024-08-15', endDate = '2024-08-16') {
  try {
    console.log(`💾 Syncing attendance to database: ${startDate} to ${endDate}...`);
    
    const client = await getSimpleAeriesClient();
    let savedCount = 0;
    let errorCount = 0;
    
    const result = await client.processAttendanceBatches(
      startDate,
      endDate,
      async (batch, batchNumber) => {
        console.log(`💾 Saving batch ${batchNumber}...`);
        
        for (const record of batch) {
          try {
            // Here you would save to your database
            // Example using the sync service we created:
            
            // await saveAttendanceRecord({
            //   student_id: record.studentId,
            //   date: record.attendanceDate,
            //   school_year: record.schoolYear,
            //   daily_status: record.dailyStatus,
            //   period_attendance: record.periods,
            //   aeries_student_number: record.studentNumber,
            //   aeries_last_modified: record.lastModified,
            //   sync_operation_id: 'manual-sync-' + Date.now()
            // });
            
            // For this example, just log
            console.log(`  ✅ Would save: Student ${record.studentNumber} - ${record.dailyStatus}`);
            savedCount++;
            
          } catch (saveError) {
            console.error(`  ❌ Save failed for student ${record.studentNumber}:`, saveError);
            errorCount++;
          }
        }
      }
    );
    
    console.log(`✅ Sync complete: ${savedCount} saved, ${errorCount} errors`);
    return { saved: savedCount, errors: errorCount };
    
  } catch (error) {
    console.error('❌ Database sync error:', error);
    return { saved: 0, errors: 1 };
  }
}

// =====================================================
// Helper: Run Any Example
// =====================================================

export async function runExample(exampleName: string) {
  console.log(`\n🚀 Running ${exampleName} example...\n`);
  
  switch (exampleName) {
    case 'test':
      return await testConnection();
    
    case 'schools':
      return await getSchools();
    
    case 'attendance':
      return await getAttendanceForOneDay();
    
    case 'batch':
      return await processAttendanceWeek();
    
    case 'complete':
      return await completeExample();
    
    case 'sync':
      return await syncToDatabase();
    
    default:
      console.log('❌ Unknown example. Available: test, schools, attendance, batch, complete, sync');
      return null;
  }
}

// =====================================================
// Quick Test Function (for development)
// =====================================================

export async function quickTest() {
  console.log('⚡ Quick test starting...');
  
  try {
    // Just test the basic functionality
    const client = await getSimpleAeriesClient();
    console.log('✅ Client initialized');
    
    const config = client.getConfig();
    console.log('📋 Config:', {
      baseUrl: config.baseUrl,
      districtCode: config.districtCode,
      batchSize: config.batchSize
    });
    
    const isHealthy = await client.healthCheck();
    console.log(`🔍 Health check: ${isHealthy ? '✅ Healthy' : '❌ Failed'}`);
    
    return isHealthy;
    
  } catch (error) {
    console.error('❌ Quick test failed:', error);
    return false;
  }
}