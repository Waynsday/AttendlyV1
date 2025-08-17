-- Check the current structure of attendance_records table
-- This will help us understand what columns exist and their types

-- Get table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'attendance_records' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check if there are any sample records to understand the data format
SELECT * FROM attendance_records LIMIT 5;