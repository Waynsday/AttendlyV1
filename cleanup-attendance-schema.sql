-- Cleanup Attendance Records Schema
-- This script removes unnecessary summary columns that should not be in daily attendance records

-- First, delete all existing incorrect data
DELETE FROM attendance_records;

-- Remove summary columns that belong in a separate summary table, not daily records
ALTER TABLE attendance_records DROP COLUMN IF EXISTS days_present;
ALTER TABLE attendance_records DROP COLUMN IF EXISTS days_absent;
ALTER TABLE attendance_records DROP COLUMN IF EXISTS days_excused;
ALTER TABLE attendance_records DROP COLUMN IF EXISTS days_unexcused;
ALTER TABLE attendance_records DROP COLUMN IF EXISTS days_tardy;
ALTER TABLE attendance_records DROP COLUMN IF EXISTS days_truancy;
ALTER TABLE attendance_records DROP COLUMN IF EXISTS days_suspension;
ALTER TABLE attendance_records DROP COLUMN IF EXISTS attendance_rate;

-- These summary columns should be in a separate attendance_summary table, not daily records
-- Daily attendance records should only contain:
-- - student_id, school_id, attendance_date (primary keys)
-- - aeries_student_id, school_code, school_year (for reference)
-- - is_present, is_full_day_absent (attendance status)
-- - period_1_status through period_7_status (period attendance)
-- - days_enrolled (for this specific day, typically 1.0)
-- - tardy_count (for this specific day)
-- - correction fields and audit fields

-- Verify the cleanup
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'attendance_records' 
ORDER BY ordinal_position;