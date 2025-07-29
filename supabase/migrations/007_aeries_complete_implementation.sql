-- =====================================================
-- Complete Aeries Implementation Database Migration
-- Migration 007: Production-ready tables and functions
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- Create or Update Aeries Sync Operations Table
-- =====================================================

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

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_aeries_sync_operations_status ON aeries_sync_operations(status);
CREATE INDEX IF NOT EXISTS idx_aeries_sync_operations_type ON aeries_sync_operations(type);
CREATE INDEX IF NOT EXISTS idx_aeries_sync_operations_start_time ON aeries_sync_operations(start_time);

-- =====================================================
-- Update Attendance Records Table for Aeries Integration
-- =====================================================

-- Add Aeries-specific columns if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attendance_records' AND column_name = 'aeries_student_number') THEN
        ALTER TABLE attendance_records ADD COLUMN aeries_student_number TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attendance_records' AND column_name = 'aeries_last_modified') THEN
        ALTER TABLE attendance_records ADD COLUMN aeries_last_modified TIMESTAMPTZ;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attendance_records' AND column_name = 'sync_operation_id') THEN
        ALTER TABLE attendance_records ADD COLUMN sync_operation_id TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attendance_records' AND column_name = 'sync_metadata') THEN
        ALTER TABLE attendance_records ADD COLUMN sync_metadata JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- Add foreign key constraint if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_attendance_sync_operation') THEN
        ALTER TABLE attendance_records 
        ADD CONSTRAINT fk_attendance_sync_operation 
        FOREIGN KEY (sync_operation_id) 
        REFERENCES aeries_sync_operations(operation_id) 
        ON DELETE SET NULL;
    END IF;
END $$;

-- Add indexes for Aeries integration
CREATE INDEX IF NOT EXISTS idx_attendance_records_aeries_student_number ON attendance_records(aeries_student_number);
CREATE INDEX IF NOT EXISTS idx_attendance_records_sync_operation ON attendance_records(sync_operation_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_aeries_modified ON attendance_records(aeries_last_modified);
CREATE INDEX IF NOT EXISTS idx_attendance_records_sync_metadata ON attendance_records USING GIN(sync_metadata);

-- =====================================================
-- Aeries Configuration Table
-- =====================================================

CREATE TABLE IF NOT EXISTS aeries_configuration (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_key TEXT NOT NULL UNIQUE,
    config_value TEXT NOT NULL,
    description TEXT,
    is_encrypted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by TEXT,
    updated_by TEXT
);

-- Insert default configuration
INSERT INTO aeries_configuration (config_key, config_value, description) VALUES
('sync_enabled', 'true', 'Enable/disable Aeries sync operations'),
('sync_schedule', '0 1 * * *', 'Cron schedule for automated sync'),
('batch_size', '100', 'Number of records to process per batch'),
('rate_limit_per_minute', '60', 'API requests per minute limit'),
('attendance_start_date', '2024-08-15', 'Start date for attendance data sync'),
('attendance_end_date', '2025-06-12', 'End date for attendance data sync'),
('connection_timeout', '30000', 'API connection timeout in milliseconds'),
('retry_attempts', '3', 'Number of retry attempts for failed requests')
ON CONFLICT (config_key) DO UPDATE SET
    config_value = EXCLUDED.config_value,
    updated_at = NOW();

-- =====================================================
-- Aeries Schools Table
-- =====================================================

CREATE TABLE IF NOT EXISTS aeries_schools (
    school_code TEXT PRIMARY KEY,
    school_name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    last_sync TIMESTAMPTZ,
    student_count INTEGER DEFAULT 0,
    sync_metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default Romoland schools
INSERT INTO aeries_schools (school_code, school_name, is_active) VALUES
('001', 'Romoland Elementary School', TRUE),
('002', 'Heritage Elementary School', TRUE),
('003', 'Mountain View Elementary School', TRUE),
('004', 'Desert View Elementary School', TRUE),
('005', 'Romoland Intermediate School', TRUE)
ON CONFLICT (school_code) DO UPDATE SET
    school_name = EXCLUDED.school_name,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- =====================================================
-- Functions for Aeries Integration
-- =====================================================

-- Function to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
DROP TRIGGER IF EXISTS update_aeries_sync_operations_updated_at ON aeries_sync_operations;
CREATE TRIGGER update_aeries_sync_operations_updated_at 
    BEFORE UPDATE ON aeries_sync_operations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_aeries_configuration_updated_at ON aeries_configuration;
CREATE TRIGGER update_aeries_configuration_updated_at 
    BEFORE UPDATE ON aeries_configuration 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_aeries_schools_updated_at ON aeries_schools;
CREATE TRIGGER update_aeries_schools_updated_at 
    BEFORE UPDATE ON aeries_schools 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to get Aeries configuration
CREATE OR REPLACE FUNCTION get_aeries_config(p_key TEXT)
RETURNS TEXT AS $$
DECLARE
    config_value TEXT;
BEGIN
    SELECT config_value INTO config_value
    FROM aeries_configuration
    WHERE config_key = p_key AND is_encrypted = FALSE;
    
    RETURN config_value;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to set Aeries configuration
CREATE OR REPLACE FUNCTION set_aeries_config(
    p_key TEXT,
    p_value TEXT,
    p_description TEXT DEFAULT NULL,
    p_updated_by TEXT DEFAULT 'system'
)
RETURNS BOOLEAN AS $$
BEGIN
    INSERT INTO aeries_configuration (config_key, config_value, description, updated_by)
    VALUES (p_key, p_value, p_description, p_updated_by)
    ON CONFLICT (config_key) DO UPDATE SET
        config_value = EXCLUDED.config_value,
        description = COALESCE(EXCLUDED.description, aeries_configuration.description),
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW();
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to get current school year
CREATE OR REPLACE FUNCTION get_current_school_year()
RETURNS TEXT AS $$
DECLARE
    current_date DATE := CURRENT_DATE;
    year INTEGER := EXTRACT(YEAR FROM current_date);
    month INTEGER := EXTRACT(MONTH FROM current_date);
BEGIN
    IF month >= 8 THEN
        RETURN year::TEXT || '-' || (year + 1)::TEXT;
    ELSE
        RETURN (year - 1)::TEXT || '-' || year::TEXT;
    END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to calculate student attendance tier with Aeries data
CREATE OR REPLACE FUNCTION calculate_student_tier_aeries(
    p_student_id TEXT,
    p_school_year TEXT DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
    school_year TEXT := COALESCE(p_school_year, get_current_school_year());
    total_days INTEGER;
    absent_days INTEGER;
    absence_rate DECIMAL;
BEGIN
    -- Get total school days and absent days from Aeries-synced data
    SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE daily_status IN ('ABSENT', 'UNEXCUSED_ABSENT')) as absent
    INTO total_days, absent_days
    FROM attendance_records 
    WHERE student_id = p_student_id 
    AND school_year = school_year
    AND date >= '2024-08-15'::DATE 
    AND date <= '2025-06-12'::DATE
    AND sync_operation_id IS NOT NULL; -- Only Aeries-synced records
    
    -- Calculate absence rate
    IF total_days > 0 THEN
        absence_rate := absent_days::DECIMAL / total_days::DECIMAL;
        
        -- Determine tier based on Romoland criteria
        IF absent_days <= 2 THEN
            RETURN 'TIER_1';
        ELSIF absent_days <= 9 THEN
            RETURN 'TIER_2';
        ELSIF absence_rate >= 0.10 THEN
            RETURN 'TIER_3';
        ELSE
            RETURN 'TIER_2';
        END IF;
    ELSE
        RETURN 'NO_DATA';
    END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get sync operation status
CREATE OR REPLACE FUNCTION get_current_sync_status()
RETURNS JSONB AS $$
DECLARE
    current_op RECORD;
    result JSONB;
BEGIN
    -- Get the most recent operation
    SELECT * INTO current_op
    FROM aeries_sync_operations
    WHERE status IN ('PENDING', 'IN_PROGRESS')
    ORDER BY start_time DESC
    LIMIT 1;
    
    IF current_op IS NULL THEN
        -- No active operation, get last completed operation
        SELECT * INTO current_op
        FROM aeries_sync_operations
        ORDER BY start_time DESC
        LIMIT 1;
        
        result := jsonb_build_object(
            'isRunning', FALSE,
            'currentOperation', NULL,
            'lastSync', COALESCE(current_op.start_time, NULL)
        );
    ELSE
        result := jsonb_build_object(
            'isRunning', current_op.status = 'IN_PROGRESS',
            'currentOperation', row_to_json(current_op)::jsonb,
            'lastSync', current_op.start_time
        );
    END IF;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- Views for Reporting and Analytics
-- =====================================================

-- View for Aeries sync dashboard
CREATE OR REPLACE VIEW aeries_sync_dashboard AS
SELECT 
    operation_id,
    type,
    status,
    start_time,
    end_time,
    EXTRACT(EPOCH FROM (COALESCE(end_time, NOW()) - start_time)) / 60 AS duration_minutes,
    (progress->>'totalRecords')::INTEGER AS total_records,
    (progress->>'successfulRecords')::INTEGER AS successful_records,
    (progress->>'failedRecords')::INTEGER AS failed_records,
    (progress->>'currentBatch')::INTEGER AS current_batch,
    (progress->>'totalBatches')::INTEGER AS total_batches,
    CASE 
        WHEN (progress->>'totalRecords')::INTEGER > 0 
        THEN ROUND(
            ((progress->>'successfulRecords')::INTEGER * 100.0) / 
            (progress->>'totalRecords')::INTEGER, 2
        )
        ELSE 0 
    END AS success_rate_percent,
    jsonb_array_length(COALESCE(errors, '[]'::jsonb)) AS error_count,
    metadata->>'initiatedBy' AS initiated_by,
    date_range->>'startDate' AS sync_start_date,
    date_range->>'endDate' AS sync_end_date
FROM aeries_sync_operations
ORDER BY start_time DESC;

-- View for attendance data with Aeries metadata
CREATE OR REPLACE VIEW aeries_attendance_summary AS
SELECT 
    ar.student_id,
    ar.date,
    ar.school_year,
    ar.daily_status,
    ar.aeries_student_number,
    ar.aeries_last_modified,
    ar.sync_operation_id,
    aso.type AS sync_type,
    aso.start_time AS sync_time,
    calculate_student_tier_aeries(ar.student_id, ar.school_year) AS current_tier,
    CASE 
        WHEN ar.aeries_last_modified IS NOT NULL 
        THEN ar.aeries_last_modified > ar.updated_at 
        ELSE false 
    END AS needs_sync_update
FROM attendance_records ar
LEFT JOIN aeries_sync_operations aso ON ar.sync_operation_id = aso.operation_id
WHERE ar.date >= '2024-08-15'::DATE 
AND ar.date <= '2025-06-12'::DATE
AND ar.sync_operation_id IS NOT NULL;

-- View for school sync status
CREATE OR REPLACE VIEW aeries_school_sync_status AS
SELECT 
    s.school_code,
    s.school_name,
    s.is_active,
    s.last_sync,
    s.student_count,
    COUNT(ar.student_id) AS synced_records,
    MAX(ar.updated_at) AS last_record_sync,
    COUNT(DISTINCT ar.student_id) AS unique_students_synced
FROM aeries_schools s
LEFT JOIN attendance_records ar ON ar.sync_metadata->>'schoolCode' = s.school_code
WHERE s.is_active = TRUE
GROUP BY s.school_code, s.school_name, s.is_active, s.last_sync, s.student_count
ORDER BY s.school_code;

-- =====================================================
-- Security and Row Level Security (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE aeries_sync_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE aeries_configuration ENABLE ROW LEVEL SECURITY;
ALTER TABLE aeries_schools ENABLE ROW LEVEL SECURITY;

-- RLS Policies for aeries_sync_operations
DROP POLICY IF EXISTS "aeries_sync_operations_select_policy" ON aeries_sync_operations;
CREATE POLICY "aeries_sync_operations_select_policy" ON aeries_sync_operations
    FOR SELECT USING (TRUE); -- Allow all authenticated users to view sync operations

DROP POLICY IF EXISTS "aeries_sync_operations_insert_policy" ON aeries_sync_operations;
CREATE POLICY "aeries_sync_operations_insert_policy" ON aeries_sync_operations
    FOR INSERT WITH CHECK (TRUE); -- Allow system to insert sync operations

DROP POLICY IF EXISTS "aeries_sync_operations_update_policy" ON aeries_sync_operations;
CREATE POLICY "aeries_sync_operations_update_policy" ON aeries_sync_operations
    FOR UPDATE USING (TRUE); -- Allow system to update sync operations

-- RLS Policies for aeries_configuration
DROP POLICY IF EXISTS "aeries_configuration_select_policy" ON aeries_configuration;
CREATE POLICY "aeries_configuration_select_policy" ON aeries_configuration
    FOR SELECT USING (TRUE); -- Allow all authenticated users to view config

DROP POLICY IF EXISTS "aeries_configuration_modify_policy" ON aeries_configuration;
CREATE POLICY "aeries_configuration_modify_policy" ON aeries_configuration
    FOR ALL USING (TRUE); -- Allow system to modify config

-- RLS Policies for aeries_schools
DROP POLICY IF EXISTS "aeries_schools_select_policy" ON aeries_schools;
CREATE POLICY "aeries_schools_select_policy" ON aeries_schools
    FOR SELECT USING (TRUE); -- Allow all authenticated users to view schools

DROP POLICY IF EXISTS "aeries_schools_modify_policy" ON aeries_schools;
CREATE POLICY "aeries_schools_modify_policy" ON aeries_schools
    FOR ALL USING (TRUE); -- Allow system to modify schools

-- =====================================================
-- Performance Optimizations
-- =====================================================

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_attendance_records_student_date_sync 
    ON attendance_records(student_id, date, sync_operation_id) 
    WHERE sync_operation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_attendance_records_school_year_sync 
    ON attendance_records(school_year, sync_operation_id) 
    WHERE date >= '2024-08-15' AND date <= '2025-06-12';

-- Partial index for active sync operations
CREATE INDEX IF NOT EXISTS idx_aeries_sync_active 
    ON aeries_sync_operations(status, start_time) 
    WHERE status IN ('PENDING', 'IN_PROGRESS');

-- =====================================================
-- Data Validation and Constraints
-- =====================================================

-- Add check constraints for data integrity
ALTER TABLE aeries_sync_operations 
ADD CONSTRAINT check_date_range_valid 
CHECK ((date_range->>'startDate')::DATE <= (date_range->>'endDate')::DATE);

ALTER TABLE aeries_sync_operations 
ADD CONSTRAINT check_progress_valid 
CHECK (
    (progress->>'processedRecords')::INTEGER >= 0 AND
    (progress->>'successfulRecords')::INTEGER >= 0 AND
    (progress->>'failedRecords')::INTEGER >= 0 AND
    (progress->>'currentBatch')::INTEGER >= 0
);

-- Add check for school year format
ALTER TABLE attendance_records 
ADD CONSTRAINT check_school_year_format 
CHECK (school_year ~ '^\d{4}-\d{4}$');

-- =====================================================
-- Grants and Permissions
-- =====================================================

-- Grant necessary permissions to service role
GRANT ALL ON aeries_sync_operations TO service_role;
GRANT ALL ON aeries_configuration TO service_role;
GRANT ALL ON aeries_schools TO service_role;

-- Grant read access to views
GRANT SELECT ON aeries_sync_dashboard TO authenticated;
GRANT SELECT ON aeries_attendance_summary TO authenticated;
GRANT SELECT ON aeries_school_sync_status TO authenticated;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION get_aeries_config(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION set_aeries_config(TEXT, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION get_current_school_year() TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_student_tier_aeries(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_current_sync_status() TO authenticated;

-- =====================================================
-- Migration Completion
-- =====================================================

-- Create migration log table if it doesn't exist
CREATE TABLE IF NOT EXISTS migration_log (
    migration_id INTEGER PRIMARY KEY,
    description TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Log migration completion
INSERT INTO migration_log (migration_id, description, applied_at) VALUES 
(7, 'Complete Aeries Implementation - Production-ready tables, functions, and views for Romoland School District', NOW())
ON CONFLICT (migration_id) DO UPDATE SET 
    applied_at = NOW(),
    description = EXCLUDED.description;

-- Final status message
DO $$
BEGIN
    RAISE NOTICE 'Aeries Complete Implementation Migration 007 completed successfully';
    RAISE NOTICE 'Tables: aeries_sync_operations, aeries_configuration, aeries_schools';
    RAISE NOTICE 'Views: aeries_sync_dashboard, aeries_attendance_summary, aeries_school_sync_status';
    RAISE NOTICE 'Functions: get_aeries_config, set_aeries_config, calculate_student_tier_aeries, get_current_sync_status';
    RAISE NOTICE 'Date Range: August 15, 2024 to June 12, 2025 (Romoland School Year)';
    RAISE NOTICE 'Ready for production deployment with Vince Butler credentials';
END $$;