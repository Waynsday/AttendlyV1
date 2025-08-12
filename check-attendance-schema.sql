-- Check the actual schema of attendance_records table in Supabase
-- Run these queries to understand the real column structure

-- 1. Get table structure for attendance_records
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'attendance_records' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Get table structure for students
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'students' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Get table structure for grade_attendance_timeline_summary
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'grade_attendance_timeline_summary' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- 4. Sample data from attendance_records to see actual values
SELECT 
    *
FROM attendance_records 
LIMIT 5;

-- 5. Check unique values in boolean/enum columns
SELECT 
    is_present,
    COUNT(*) as count
FROM attendance_records 
GROUP BY is_present;

-- 6. Check for any other attendance-related columns
SELECT 
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_name = 'attendance_records' 
    AND column_name ILIKE '%absent%' 
    OR column_name ILIKE '%tardy%'
    OR column_name ILIKE '%excuse%'
    OR column_name ILIKE '%type%';

-- 7. Check students table for grade_level column
SELECT 
    grade_level,
    COUNT(*) as student_count
FROM students 
WHERE grade_level IS NOT NULL
GROUP BY grade_level
ORDER BY grade_level;

-- 8. Check relationship between attendance_records and students
SELECT 
    COUNT(*) as total_attendance_records,
    COUNT(DISTINCT ar.student_id) as unique_students_in_attendance,
    COUNT(DISTINCT s.id) as unique_students_in_students_table,
    COUNT(CASE WHEN s.id IS NULL THEN 1 END) as orphaned_attendance_records
FROM attendance_records ar
LEFT JOIN students s ON ar.student_id = s.id;