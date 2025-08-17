-- Clear all existing attendance records
-- This will remove all data from the attendance_records table

-- First, check current count before deletion
SELECT 'Records before deletion:' as status, COUNT(*) as record_count 
FROM attendance_records;

-- Delete all records from attendance_records table
DELETE FROM attendance_records;

-- Verify deletion
SELECT 'Records after deletion:' as status, COUNT(*) as record_count 
FROM attendance_records;

-- Reset auto-increment sequence if needed (for PostgreSQL)
-- This ensures the next inserted record starts with a fresh ID
SELECT setval(pg_get_serial_sequence('attendance_records', 'id'), 1, false);

-- Show confirmation message
SELECT 'Attendance records table cleared successfully' as confirmation;