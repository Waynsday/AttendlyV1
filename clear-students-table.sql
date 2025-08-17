-- Clear all existing students records
-- This will remove all data from the students table

-- First, check current count before deletion
SELECT 'Students before deletion:' as status, COUNT(*) as student_count 
FROM students;

-- Delete all records from students table
DELETE FROM students;

-- Verify deletion
SELECT 'Students after deletion:' as status, COUNT(*) as student_count 
FROM students;

-- Reset auto-increment sequence if needed (for PostgreSQL)
-- This ensures the next inserted record starts with a fresh ID
SELECT setval(pg_get_serial_sequence('students', 'id'), 1, false);

-- Show confirmation message
SELECT 'Students table cleared successfully' as confirmation;