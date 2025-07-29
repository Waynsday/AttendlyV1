/**
 * @fileoverview Supabase Connection Test
 * 
 * This script tests the Supabase connection and verifies
 * database operations are working correctly.
 */

import { createClient } from './src/lib/supabase/server';
import { createAdminClient } from './src/lib/supabase/server';

async function testSupabaseConnection() {
  console.log('🔗 Testing Supabase Connection...');
  console.log('================================\n');

  try {
    // Step 1: Test environment variables
    console.log('1️⃣ Checking environment variables...');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || supabaseUrl === 'your-supabase-url-here') {
      console.error('❌ NEXT_PUBLIC_SUPABASE_URL not configured in .env.local');
      console.error('   Please add your Supabase project URL');
      return false;
    }

    if (!supabaseAnonKey || supabaseAnonKey === 'your-supabase-anon-key-here') {
      console.error('❌ NEXT_PUBLIC_SUPABASE_ANON_KEY not configured in .env.local');
      console.error('   Please add your Supabase anonymous key');
      return false;
    }

    if (!supabaseServiceKey || supabaseServiceKey === 'your-supabase-service-role-key-here') {
      console.error('❌ SUPABASE_SERVICE_ROLE_KEY not configured in .env.local');
      console.error('   This is needed for admin operations');
    }

    console.log('✅ Environment variables configured');
    console.log(`   URL: ${supabaseUrl}`);
    console.log(`   Anon Key: ${supabaseAnonKey.substring(0, 20)}...`);
    console.log('');

    // Step 2: Test basic client connection
    console.log('2️⃣ Testing client connection...');
    const client = await createClient();
    
    // Try a simple query to test connection
    const { data: healthCheck, error: healthError } = await client
      .from('attendance_records')
      .select('count')
      .limit(1);

    if (healthError) {
      console.error('❌ Client connection failed:', healthError.message);
      console.error('   This could mean:');
      console.error('   - Wrong URL or keys');
      console.error('   - Network connectivity issues');
      console.error('   - Table "attendance_records" doesn\'t exist yet');
      return false;
    }

    console.log('✅ Basic client connection successful');
    console.log('');

    // Step 3: Test admin client (if configured)
    if (supabaseServiceKey && supabaseServiceKey !== 'your-supabase-service-role-key-here') {
      console.log('3️⃣ Testing admin client...');
      const adminClient = createAdminClient();
      
      const { data: adminHealth, error: adminError } = await adminClient
        .from('attendance_records')
        .select('count')
        .limit(1);

      if (adminError) {
        console.error('❌ Admin client connection failed:', adminError.message);
        return false;
      }

      console.log('✅ Admin client connection successful');
      console.log('');
    }

    // Step 4: Test creating a test record
    console.log('4️⃣ Testing record creation...');
    
    const testRecord = {
      student_id: 'test-student-' + Date.now(),
      date: new Date().toISOString().split('T')[0],
      school_year: '2024-2025',
      daily_status: 'P', // Present
      period_attendance: [],
      aeries_student_number: 'TEST001',
      aeries_last_modified: new Date().toISOString(),
      sync_operation_id: 'supabase-test-' + Date.now(),
      sync_metadata: {
        source: 'connection_test',
        test: true,
        createdAt: new Date().toISOString()
      }
    };

    const { data: insertData, error: insertError } = await client
      .from('attendance_records')
      .insert(testRecord)
      .select()
      .single();

    if (insertError) {
      console.error('❌ Failed to create test record:', insertError.message);
      console.error('   This might mean the table schema needs to be updated');
      return false;
    }

    console.log('✅ Test record created successfully');
    console.log(`   Record ID: ${insertData.id}`);
    console.log('');

    // Step 5: Test updating the record
    console.log('5️⃣ Testing record update...');
    
    const { data: updateData, error: updateError } = await client
      .from('attendance_records')
      .update({
        daily_status: 'A', // Absent
        sync_metadata: {
          ...testRecord.sync_metadata,
          updated: true,
          updatedAt: new Date().toISOString()
        }
      })
      .eq('id', insertData.id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Failed to update test record:', updateError.message);
      return false;
    }

    console.log('✅ Test record updated successfully');
    console.log(`   Status changed from P to ${updateData.daily_status}`);
    console.log('');

    // Step 6: Test querying records
    console.log('6️⃣ Testing record queries...');
    
    const { data: queryData, error: queryError } = await client
      .from('attendance_records')
      .select('*')
      .eq('student_id', testRecord.student_id)
      .single();

    if (queryError) {
      console.error('❌ Failed to query test record:', queryError.message);
      return false;
    }

    console.log('✅ Test record queried successfully');
    console.log(`   Found record for student: ${queryData.student_id}`);
    console.log('');

    // Step 7: Clean up test record
    console.log('7️⃣ Cleaning up test record...');
    
    const { error: deleteError } = await client
      .from('attendance_records')
      .delete()
      .eq('id', insertData.id);

    if (deleteError) {
      console.error('⚠️  Failed to delete test record:', deleteError.message);
      console.error('   You may need to manually clean this up');
    } else {
      console.log('✅ Test record cleaned up successfully');
    }

    console.log('');
    console.log('================================');
    console.log('🎉 All Supabase tests passed!');
    console.log('================================');
    console.log('');
    console.log('Your Supabase connection is working correctly.');
    console.log('You can now:');
    console.log('- Create attendance records');
    console.log('- Update existing records');
    console.log('- Query the database');
    console.log('- Use the Aeries sync functionality');
    
    return true;

  } catch (error) {
    console.error('\n❌ Supabase test failed:', error);
    console.error('\nTroubleshooting:');
    console.error('1. Check your Supabase project URL and keys in .env.local');
    console.error('2. Verify your Supabase project is active');
    console.error('3. Ensure the attendance_records table exists');
    console.error('4. Check network connectivity to Supabase');
    return false;
  }
}

// Function to show current configuration (without revealing keys)
function showCurrentConfig() {
  console.log('📋 Current Supabase Configuration:');
  console.log('================================');
  console.log(`URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL || 'Not configured'}`);
  console.log(`Anon Key: ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Configured (' + process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 10) + '...)' : 'Not configured'}`);
  console.log(`Service Key: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Configured (' + process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 10) + '...)' : 'Not configured'}`);
  console.log('');
}

// Run if called directly
if (require.main === module) {
  showCurrentConfig();
  testSupabaseConnection()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { testSupabaseConnection, showCurrentConfig };