-- Check the current structure of students table
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'students' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check current count
SELECT COUNT(*) as current_student_count FROM students;