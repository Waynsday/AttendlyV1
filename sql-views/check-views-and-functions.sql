-- Check existing views and functions to identify duplicates
-- Execute this in Supabase Dashboard SQL Editor

-- 1. List all views related to students or attendance
SELECT 
  schemaname,
  viewname,
  definition
FROM pg_views 
WHERE viewname LIKE '%student%' 
   OR viewname LIKE '%attendance%'
ORDER BY viewname;

-- 2. List all functions related to students
SELECT 
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as return_type
FROM pg_proc p
LEFT JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname LIKE '%student%'
ORDER BY p.proname;

-- 3. Check what columns are expected vs what the function returns
SELECT 
  p.proname,
  pg_get_function_result(p.oid) as declared_return_type
FROM pg_proc p
LEFT JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'get_student_attendance_data';

-- 4. Check current table structure for attendance_records
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'attendance_records' 
  AND table_schema = 'public'
ORDER BY ordinal_position;