/**
 * @fileoverview Supabase Test API Route
 * 
 * Test endpoint to verify Supabase connection and database operations
 * within the Next.js app context.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const test = searchParams.get('test') || 'connection';

  try {
    switch (test) {
      case 'connection':
        return await testConnection();
      case 'admin':
        return await testAdminConnection();
      case 'schema':
        return await testSchema();
      case 'create':
        return await testCreateRecord();
      case 'update':
        return await testUpdateRecord();
      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid test parameter',
          availableTests: ['connection', 'admin', 'schema', 'create', 'update']
        });
    }
  } catch (error) {
    console.error('Supabase test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}

async function testConnection() {
  try {
    const client = await createClient();
    
    // Test basic connection with a simple query
    const { data, error } = await client
      .from('attendance_records')
      .select('count')
      .limit(1);

    if (error) {
      return NextResponse.json({
        success: false,
        connected: false,
        error: error.message,
        suggestion: error.message.includes('does not exist') 
          ? 'Run database migrations to create tables'
          : 'Check Supabase configuration'
      });
    }

    return NextResponse.json({
      success: true,
      connected: true,
      message: 'Supabase client connection successful',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      connected: false,
      error: error instanceof Error ? error.message : 'Connection failed'
    });
  }
}

async function testAdminConnection() {
  try {
    const adminClient = createAdminClient();
    
    // Test admin connection by checking system information
    const { data, error } = await adminClient
      .rpc('exec_sql', { 
        sql: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' LIMIT 10;` 
      });

    if (error) {
      return NextResponse.json({
        success: false,
        connected: false,
        error: error.message
      });
    }

    return NextResponse.json({
      success: true,
      connected: true,
      message: 'Admin client connection successful',
      tables: data?.map(t => t.table_name) || [],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      connected: false,
      error: error instanceof Error ? error.message : 'Admin connection failed'
    });
  }
}

async function testSchema() {
  try {
    const adminClient = createAdminClient();
    
    // Get table schema information
    const { data: tables, error: tablesError } = await adminClient
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public');

    const { data: columns, error: columnsError } = await adminClient
      .from('information_schema.columns')
      .select('table_name, column_name, data_type')
      .eq('table_schema', 'public')
      .eq('table_name', 'attendance_records');

    if (tablesError) {
      return NextResponse.json({
        success: false,
        error: tablesError.message
      });
    }

    return NextResponse.json({
      success: true,
      tables: tables?.map(t => t.table_name) || [],
      attendanceRecordsColumns: columns || [],
      hasAttendanceTable: tables?.some(t => t.table_name === 'attendance_records') || false,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Schema check failed'
    });
  }
}

async function testCreateRecord() {
  try {
    const client = await createClient();
    
    const testRecord = {
      student_id: 'api-test-' + Date.now(),
      date: new Date().toISOString().split('T')[0],
      school_year: '2024-2025',
      daily_status: 'P',
      period_attendance: [],
      sync_metadata: {
        source: 'api_test',
        createdAt: new Date().toISOString()
      }
    };

    const { data, error } = await client
      .from('attendance_records')
      .insert(testRecord)
      .select()
      .single();

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message,
        suggestion: 'Check if attendance_records table exists and has correct schema'
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Test record created successfully',
      recordId: data.id,
      studentId: data.student_id,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Create test failed'
    });
  }
}

async function testUpdateRecord() {
  try {
    const client = await createClient();
    
    // First create a test record
    const testRecord = {
      student_id: 'update-test-' + Date.now(),
      date: new Date().toISOString().split('T')[0],
      school_year: '2024-2025',
      daily_status: 'P',
      period_attendance: [],
      sync_metadata: {
        source: 'update_test',
        createdAt: new Date().toISOString()
      }
    };

    const { data: insertData, error: insertError } = await client
      .from('attendance_records')
      .insert(testRecord)
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({
        success: false,
        error: `Insert failed: ${insertError.message}`
      });
    }

    // Then update it
    const { data: updateData, error: updateError } = await client
      .from('attendance_records')
      .update({
        daily_status: 'A',
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
      return NextResponse.json({
        success: false,
        error: `Update failed: ${updateError.message}`
      });
    }

    // Clean up test record
    await client
      .from('attendance_records')
      .delete()
      .eq('id', insertData.id);

    return NextResponse.json({
      success: true,
      message: 'Create, update, and delete test completed successfully',
      originalStatus: insertData.daily_status,
      updatedStatus: updateData.daily_status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Update test failed'
    });
  }
}