/**
 * @fileoverview Run Manual Aeries Sync
 * 
 * Execute this file to immediately sync attendance data
 * after setting up your certificate.
 */

import { getSimpleAeriesClient } from './src/lib/aeries/simple-aeries-client';
import { createClient } from './src/lib/supabase/server';

async function runManualSync() {
  console.log('🚀 Starting Manual Aeries Sync...');
  console.log('================================\n');

  try {
    // Step 1: Test connection
    console.log('1️⃣ Testing Aeries connection...');
    const client = await getSimpleAeriesClient();
    const isHealthy = await client.healthCheck();
    
    if (!isHealthy) {
      console.error('❌ Aeries connection failed. Please check your certificate.');
      process.exit(1);
    }
    
    console.log('✅ Connected to Aeries successfully!\n');

    // Step 2: Get schools
    console.log('2️⃣ Fetching schools...');
    const schools = await client.getSchools();
    
    if (schools.success) {
      console.log(`✅ Found ${schools.data.length} schools:`);
      schools.data.forEach(school => {
        console.log(`   - ${school.schoolName} (${school.schoolCode})`);
      });
    } else {
      console.log('⚠️  No schools found');
    }
    console.log('');

    // Step 3: Sync attendance for a specific date range
    const startDate = '2024-08-15'; // First day of school
    const endDate = '2024-08-16';   // Just sync 2 days for testing
    
    console.log(`3️⃣ Syncing attendance from ${startDate} to ${endDate}...\n`);
    
    let totalSynced = 0;
    let totalErrors = 0;
    const supabase = createClient();

    const result = await client.processAttendanceBatches(
      startDate,
      endDate,
      async (batch, batchNumber) => {
        console.log(`📦 Processing batch ${batchNumber} (${batch.length} records)...`);
        
        for (const record of batch) {
          try {
            // Save to database
            const { error } = await supabase
              .from('attendance_records')
              .upsert({
                student_id: record.studentId,
                date: record.attendanceDate,
                school_year: record.schoolYear || '2024-2025',
                daily_status: record.dailyStatus,
                period_attendance: record.periods,
                aeries_student_number: record.studentNumber,
                aeries_last_modified: record.lastModified,
                sync_operation_id: `manual-sync-${Date.now()}`,
                sync_metadata: {
                  source: 'manual_sync',
                  syncedAt: new Date().toISOString()
                }
              }, {
                onConflict: 'student_id,date'
              });

            if (error) {
              console.error(`   ❌ Failed to save student ${record.studentNumber}:`, error.message);
              totalErrors++;
            } else {
              totalSynced++;
              
              // Log progress every 10 records
              if (totalSynced % 10 === 0) {
                console.log(`   ✅ Synced ${totalSynced} records so far...`);
              }
            }

          } catch (error) {
            console.error(`   ❌ Error processing record:`, error);
            totalErrors++;
          }
        }
        
        console.log(`✅ Batch ${batchNumber} complete\n`);
      }
    );

    // Step 4: Summary
    console.log('================================');
    console.log('📊 Sync Summary:');
    console.log(`✅ Total synced: ${totalSynced} records`);
    console.log(`❌ Total errors: ${totalErrors} records`);
    console.log(`📦 Total batches: ${result.totalBatches}`);
    console.log('================================\n');

    if (totalSynced > 0) {
      console.log('🎉 Sync completed successfully!');
      console.log('You can now view the attendance data in your dashboard.');
    } else {
      console.log('⚠️  No records were synced. This might mean:');
      console.log('   - No attendance data for the specified dates');
      console.log('   - Certificate authentication issues');
      console.log('   - API endpoint differences');
    }

  } catch (error) {
    console.error('\n❌ Sync failed:', error);
    console.error('\nTroubleshooting:');
    console.error('1. Check your certificate is properly formatted');
    console.error('2. Verify the API URL is correct');
    console.error('3. Ensure you have internet connectivity');
  }
}

// Run if called directly
if (require.main === module) {
  runManualSync()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { runManualSync };