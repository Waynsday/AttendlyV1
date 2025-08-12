/**
 * @fileoverview Supabase Setup API Route
 * 
 * Creates the necessary database tables and schema for the AP Tool
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const adminClient = createAdminClient();

    console.log('Setting up database schema...');

    // Drop existing table if it exists and recreate with correct schema
    const setupSQL = `
      -- Drop existing table to start fresh
      DROP TABLE IF EXISTS attendance_records CASCADE;
      
      -- Enable required extensions
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      
      -- Create attendance_records table with correct schema
      CREATE TABLE attendance_records (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        student_id TEXT NOT NULL,
        date DATE NOT NULL,
        school_year TEXT NOT NULL DEFAULT '2024-2025',
        daily_status TEXT NOT NULL,
        period_attendance JSONB DEFAULT '[]'::jsonb,
        aeries_student_number TEXT,
        aeries_last_modified TIMESTAMPTZ,
        sync_operation_id TEXT,
        sync_metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(student_id, date)
      );

      -- Add indexes for performance
      CREATE INDEX IF NOT EXISTS idx_attendance_records_student_id ON attendance_records(student_id);
      CREATE INDEX IF NOT EXISTS idx_attendance_records_date ON attendance_records(date);
      CREATE INDEX IF NOT EXISTS idx_attendance_records_school_year ON attendance_records(school_year);
      CREATE INDEX IF NOT EXISTS idx_attendance_records_aeries_student_number ON attendance_records(aeries_student_number);
      
      -- Enable Row Level Security
      ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
      
      -- Create RLS policies
      CREATE POLICY "attendance_records_select_policy" ON attendance_records
        FOR SELECT USING (true);
        
      CREATE POLICY "attendance_records_insert_policy" ON attendance_records
        FOR INSERT WITH CHECK (true);
        
      CREATE POLICY "attendance_records_update_policy" ON attendance_records
        FOR UPDATE USING (true);
        
      CREATE POLICY "attendance_records_delete_policy" ON attendance_records
        FOR DELETE USING (true);

      -- Create aeries_sync_operations table
      CREATE TABLE IF NOT EXISTS aeries_sync_operations (
        operation_id TEXT PRIMARY KEY,
        type TEXT NOT NULL CHECK (type IN ('FULL_SYNC', 'INCREMENTAL_SYNC', 'MANUAL_SYNC')),
        status TEXT NOT NULL CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED')),
        start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        end_time TIMESTAMPTZ,
        date_range JSONB NOT NULL,
        progress JSONB NOT NULL DEFAULT '{
            "totalRecords": 0,
            "processedRecords": 0,
            "successfulRecords": 0,
            "failedRecords": 0,
            "currentBatch": 0,
            "totalBatches": 0
        }'::jsonb,
        errors JSONB DEFAULT '[]'::jsonb,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- Add indexes for sync operations
      CREATE INDEX IF NOT EXISTS idx_aeries_sync_operations_status ON aeries_sync_operations(status);
      CREATE INDEX IF NOT EXISTS idx_aeries_sync_operations_type ON aeries_sync_operations(type);
      CREATE INDEX IF NOT EXISTS idx_aeries_sync_operations_start_time ON aeries_sync_operations(start_time);

      -- Enable RLS on sync operations
      ALTER TABLE aeries_sync_operations ENABLE ROW LEVEL SECURITY;
      
      CREATE POLICY "aeries_sync_operations_select_policy" ON aeries_sync_operations
        FOR SELECT USING (true);
        
      CREATE POLICY "aeries_sync_operations_insert_policy" ON aeries_sync_operations
        FOR INSERT WITH CHECK (true);
        
      CREATE POLICY "aeries_sync_operations_update_policy" ON aeries_sync_operations
        FOR UPDATE USING (true);
    `;

    // Execute the setup SQL
    const { data, error } = await adminClient.rpc('query', { 
      query: setupSQL 
    });

    if (error) {
      console.error('Setup error:', error);
      return NextResponse.json({
        success: false,
        error: error.message,
        details: error
      });
    }

    // Test the created table
    const { data: testData, error: testError } = await adminClient
      .from('attendance_records')
      .select('count')
      .limit(1);

    if (testError) {
      return NextResponse.json({
        success: false,
        error: 'Table creation appeared to succeed but test failed',
        testError: testError.message
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Database schema created successfully',
      tablesCreated: ['attendance_records', 'aeries_sync_operations'],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Setup failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}