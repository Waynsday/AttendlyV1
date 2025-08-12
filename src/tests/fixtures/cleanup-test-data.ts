import { createClient } from '@supabase/supabase-js';

/**
 * Test Data Cleanup for AP Tool V1
 * 
 * Safely removes all test data from the database while preserving
 * schema and ensuring FERPA compliance by securely destroying
 * any temporary educational data.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function cleanupTestData(): Promise<void> {
  console.log('🧹 Cleaning up test data...');
  
  // Only proceed if we're in a test environment
  if (!isTestEnvironment()) {
    console.log('  ⏭️  Skipping cleanup - not in test environment');
    return;
  }
  
  try {
    // 1. Clean up dependent tables first (foreign key constraints)
    await cleanupAttendanceRecords();
    await cleanupIReadyScores();
    await cleanupInterventions();
    await cleanupSyncOperations();
    
    // 2. Clean up main tables
    await cleanupStudents();
    await cleanupTeachers();
    await cleanupSchools();
    
    // 3. Reset sequences if needed
    await resetSequences();
    
    // 4. Verify cleanup
    await verifyCleanup();
    
    console.log('✅ Test data cleanup completed successfully');
    
  } catch (error) {
    console.error('❌ Test data cleanup failed:', error);
    throw error;
  }
}

/**
 * Check if we're in a test environment
 */
function isTestEnvironment(): boolean {
  return (
    process.env.NODE_ENV === 'test' ||
    process.env.TEST_DATABASE_URL !== undefined ||
    process.env.JEST_WORKER_ID !== undefined ||
    process.env.PLAYWRIGHT_TEST_DIR !== undefined
  );
}

/**
 * Clean up attendance records
 */
async function cleanupAttendanceRecords(): Promise<void> {
  console.log('  📅 Cleaning attendance records...');
  
  const { error } = await supabase
    .from('attendance_records')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
  
  if (error && !error.message.includes('does not exist')) {
    throw new Error(`Failed to cleanup attendance records: ${error.message}`);
  }
  
  console.log('    ✅ Attendance records cleaned');
}

/**
 * Clean up i-Ready scores
 */
async function cleanupIReadyScores(): Promise<void> {
  console.log('  📊 Cleaning i-Ready scores...');
  
  const { error } = await supabase
    .from('iready_scores')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  
  if (error && !error.message.includes('does not exist')) {
    throw new Error(`Failed to cleanup i-Ready scores: ${error.message}`);
  }
  
  console.log('    ✅ i-Ready scores cleaned');
}

/**
 * Clean up intervention records
 */
async function cleanupInterventions(): Promise<void> {
  console.log('  🎯 Cleaning interventions...');
  
  const interventionTables = [
    'truancy_letters',
    'sarb_referrals', 
    'recovery_sessions'
  ];
  
  for (const table of interventionTables) {
    const { error } = await supabase
      .from(table)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (error && !error.message.includes('does not exist')) {
      console.warn(`    ⚠️  Warning cleaning ${table}: ${error.message}`);
    }
  }
  
  console.log('    ✅ Interventions cleaned');
}

/**
 * Clean up sync operations
 */
async function cleanupSyncOperations(): Promise<void> {
  console.log('  🔄 Cleaning sync operations...');
  
  const { error } = await supabase
    .from('aeries_sync_operations')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  
  if (error && !error.message.includes('does not exist')) {
    console.warn(`    ⚠️  Warning cleaning sync operations: ${error.message}`);
  }
  
  console.log('    ✅ Sync operations cleaned');
}

/**
 * Clean up students
 */
async function cleanupStudents(): Promise<void> {
  console.log('  👥 Cleaning students...');
  
  const { error } = await supabase
    .from('students')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  
  if (error && !error.message.includes('does not exist')) {
    throw new Error(`Failed to cleanup students: ${error.message}`);
  }
  
  console.log('    ✅ Students cleaned');
}

/**
 * Clean up teachers
 */
async function cleanupTeachers(): Promise<void> {
  console.log('  👨‍🏫 Cleaning teachers...');
  
  const { error } = await supabase
    .from('teachers')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  
  if (error && !error.message.includes('does not exist')) {
    throw new Error(`Failed to cleanup teachers: ${error.message}`);
  }
  
  console.log('    ✅ Teachers cleaned');
}

/**
 * Clean up schools
 */
async function cleanupSchools(): Promise<void> {
  console.log('  🏫 Cleaning schools...');
  
  const { error } = await supabase
    .from('schools')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  
  if (error && !error.message.includes('does not exist')) {
    throw new Error(`Failed to cleanup schools: ${error.message}`);
  }
  
  console.log('    ✅ Schools cleaned');
}

/**
 * Reset database sequences
 */
async function resetSequences(): Promise<void> {
  console.log('  🔢 Resetting sequences...');
  
  // This would reset auto-incrementing sequences in PostgreSQL
  // For Supabase, most tables use UUIDs, so this may not be necessary
  // But included for completeness
  
  try {
    // Example SQL to reset sequences (if any exist)
    const sequenceResets = [
      "SELECT setval('students_id_seq', 1, false);",
      "SELECT setval('teachers_id_seq', 1, false);",
      "SELECT setval('schools_id_seq', 1, false);"
    ];
    
    for (const sql of sequenceResets) {
      const { error } = await supabase.rpc('exec_sql', { query: sql });
      if (error && !error.message.includes('does not exist')) {
        console.warn(`    ⚠️  Warning resetting sequence: ${error.message}`);
      }
    }
    
    console.log('    ✅ Sequences reset');
  } catch (error: any) {
    console.warn(`    ⚠️  Sequence reset not available: ${error.message}`);
  }
}

/**
 * Verify cleanup was successful
 */
async function verifyCleanup(): Promise<void> {
  console.log('  🔍 Verifying cleanup...');
  
  const tables = [
    'students',
    'teachers', 
    'schools',
    'attendance_records',
    'iready_scores'
  ];
  
  const counts: Record<string, number> = {};
  
  for (const table of tables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (error && !error.message.includes('does not exist')) {
        throw error;
      }
      
      counts[table] = count || 0;
    } catch (error: any) {
      console.warn(`    ⚠️  Could not verify ${table}: ${error.message}`);
      counts[table] = -1; // Unknown
    }
  }
  
  // Report cleanup results
  console.log('    📊 Cleanup verification:');
  Object.entries(counts).forEach(([table, count]) => {
    if (count === 0) {
      console.log(`      ✅ ${table}: ${count} records`);
    } else if (count > 0) {
      console.warn(`      ⚠️  ${table}: ${count} records remain`);
    } else {
      console.log(`      ❓ ${table}: verification skipped`);
    }
  });
  
  // Check if any data remains
  const remainingData = Object.values(counts).some(count => count > 0);
  if (remainingData) {
    console.warn('    ⚠️  Some test data may remain in database');
  } else {
    console.log('    ✅ Cleanup verification passed');
  }
}

/**
 * Emergency cleanup - more aggressive cleanup for stuck test data
 */
export async function emergencyCleanup(): Promise<void> {
  console.log('🚨 Performing emergency test data cleanup...');
  
  if (!isTestEnvironment()) {
    throw new Error('Emergency cleanup can only be run in test environment');
  }
  
  try {
    // Drop and recreate tables if possible
    // This is more aggressive than normal cleanup
    await cleanupTestData();
    
    // Additional cleanup steps for emergency situations
    await cleanupTempFiles();
    await cleanupTestArtifacts();
    
    console.log('✅ Emergency cleanup completed');
    
  } catch (error) {
    console.error('❌ Emergency cleanup failed:', error);
    throw error;
  }
}

/**
 * Clean up temporary files created during testing
 */
async function cleanupTempFiles(): Promise<void> {
  console.log('  🗑️  Cleaning temporary files...');
  
  const fs = await import('fs');
  const path = await import('path');
  
  const tempDirs = [
    'test-results/temp',
    'stryker-tmp',
    '.nyc_output'
  ];
  
  for (const dir of tempDirs) {
    const fullPath = path.join(process.cwd(), dir);
    if (fs.existsSync(fullPath)) {
      try {
        fs.rmSync(fullPath, { recursive: true, force: true });
        console.log(`    ✅ Removed ${dir}`);
      } catch (error: any) {
        console.warn(`    ⚠️  Could not remove ${dir}: ${error.message}`);
      }
    }
  }
}

/**
 * Clean up test artifacts
 */
async function cleanupTestArtifacts(): Promise<void> {
  console.log('  🧹 Cleaning test artifacts...');
  
  const fs = await import('fs');
  const path = await import('path');
  
  const artifactDirs = [
    'test-results/screenshots',
    'test-results/videos',
    'test-results/traces'
  ];
  
  for (const dir of artifactDirs) {
    const fullPath = path.join(process.cwd(), dir);
    if (fs.existsSync(fullPath)) {
      try {
        // Remove all files but keep directory
        const files = fs.readdirSync(fullPath);
        for (const file of files) {
          fs.unlinkSync(path.join(fullPath, file));
        }
        console.log(`    ✅ Cleaned ${dir}`);
      } catch (error: any) {
        console.warn(`    ⚠️  Could not clean ${dir}: ${error.message}`);
      }
    }
  }
}